import { NextResponse } from "next/server";
import type { Page } from "playwright";
import { withAshbourneBrowser } from "@/lib/ashbourne/client";
import { loginToAshbourne } from "@/lib/ashbourne/auth";
import { AshbourneConnectorError } from "@/lib/ashbourne/types";

export const dynamic = "force-dynamic";

const ALL_MEMBERS_REPORT_URL = "https://secure.ashbournemanagement.co.uk/bi/dashboard/reports/reportmembership.aspx?id=1";

async function snapshot(page: Page, label: string) {
  const url = page.url();
  const buttons = await page
    .locator('button, a, [onclick], [role="button"]')
    .evaluateAll((els) =>
      els
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().slice(0, 60) ?? "",
          onclick: el.getAttribute("onclick"),
          id: el.id || null,
        }))
        .filter((l) => l.text.length > 0 && l.text.length < 60)
    );
  const seen = new Set<string>();
  const uniqueButtons = buttons.filter((b) => {
    const key = `${b.tag}::${b.text}::${b.onclick ?? ""}::${b.id ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const bodyText = await page
    .locator("body")
    .innerText()
    .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 1500))
    .catch(() => "");

  let gridHeaders: string[] | null = null;
  const gridLocator = page.locator("#ctl00_cpMain_gvReport");
  if ((await gridLocator.count()) > 0) {
    const headerCells = await gridLocator.locator("tr").first().locator("th, td").allTextContents();
    gridHeaders = headerCells.map((h) => h.trim());
  }

  return { label, url, buttons: uniqueButtons, bodyText, gridHeaders };
}

/** TEMPORARY — read-only against Ashbourne (navigates + clicks buttons
 * that dismiss filter panels / advance a report wizard; never submits a
 * campaign action like SMS/Email, never writes to our own DB). Driving
 * through the "All Members" report (reportmembership.aspx?id=1) to find
 * its results grid and real column headers, now that reportcategory
 * exploration confirmed it's the report with Status/Membership Type data.
 * Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const trace: Record<string, unknown>[] = [];

  try {
    await withAshbourneBrowser(async (page, cfg) => {
      await loginToAshbourne(page, cfg);

      await page.goto(ALL_MEMBERS_REPORT_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      trace.push(await snapshot(page, "loaded-report-page"));

      // Previous attempt: force-clicking the "OK" button still failed with
      // "Element is not visible" — that error survives force:true only
      // when the element has NO layout at all (display:none), which is
      // exactly what a not-yet-opened Bootstrap modal looks like
      // (data-dismiss="modal" confirmed this is a modal control). So this
      // OK almost certainly belongs to a Report Destination-style modal
      // that only appears later, not to the filter side panel itself. The
      // panel's own instructions say "...then NEXT to continue" — skip OK
      // entirely and close the panel via its "×" (closeNav('filterPanel'))
      // instead, then go straight for Next.
      const closePanelBtn = page.locator('[onclick*="closeNav"]').first();
      const closePanelCount = await closePanelBtn.count();
      let closePanelError: string | null = null;
      if (closePanelCount > 0) {
        try {
          await closePanelBtn.click({ force: true, timeout: 5000 });
        } catch (err) {
          closePanelError = err instanceof Error ? err.message : String(err);
        }
      }
      await page.waitForTimeout(800);
      trace.push({ ...(await snapshot(page, "after-close-panel")), closePanelCount, closePanelError });

      const nextById = page.locator("#ctl00_cpMain_btnNext");
      const nextByText = page.locator("button, a").filter({ hasText: /^next$/i }).first();
      const nextBtn = (await nextById.count()) > 0 ? nextById : nextByText;
      const nextCount = await nextBtn.count();
      let nextClickError: string | null = null;
      if (nextCount > 0) {
        const urlBefore = page.url();
        try {
          await nextBtn.click({ timeout: 5000 });
        } catch (err) {
          nextClickError = err instanceof Error ? err.message : String(err);
        }
        try {
          await page.waitForFunction((prev) => window.location.href !== prev, urlBefore, { timeout: 8000 });
        } catch {
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        }
      }
      trace.push({ ...(await snapshot(page, "after-next")), nextCount, nextClickError });

      // If that revealed a Report Destination-style modal (mirroring the
      // New Members report's Campaign -> VIEW DATA -> OK -> Next), the OK
      // button should be genuinely visible now — try the same sequence.
      const viewDataOption = page.getByText(/^view data$/i).first();
      if ((await viewDataOption.count()) > 0) {
        await viewDataOption.click().catch(() => {});
        const modalOk = page.locator("button", { hasText: /^OK$/ }).first();
        if ((await modalOk.count()) > 0) {
          await modalOk.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(800);
        }
        const urlBefore2 = page.url();
        if ((await page.locator("#ctl00_cpMain_btnNext").count()) > 0) {
          await page
            .locator("#ctl00_cpMain_btnNext")
            .click()
            .catch(() => {});
          try {
            await page.waitForFunction((prev) => window.location.href !== prev, urlBefore2, { timeout: 8000 });
          } catch {
            await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          }
        }
        trace.push(await snapshot(page, "after-view-data-modal"));
      }
    });

    return NextResponse.json({ trace });
  } catch (err) {
    const errorMessage = err instanceof AshbourneConnectorError ? `[${err.step}] ${err.message}` : err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: errorMessage, trace }, { status: 500 });
  }
}
