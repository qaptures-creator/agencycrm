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

      // First pass used getByRole + isVisible() and it never matched, even
      // though the OK button clearly appears in a plain tag/text scan —
      // fall back to a plain text-based button locator with a forced click
      // (bypassing actionability checks) so a stacking/overlay quirk can't
      // silently no-op this step again.
      const okBtn = page.locator("button", { hasText: /^OK$/ }).first();
      const okCount = await okBtn.count();
      let okClickError: string | null = null;
      if (okCount > 0) {
        try {
          await okBtn.click({ force: true, timeout: 5000 });
        } catch (err) {
          okClickError = err instanceof Error ? err.message : String(err);
        }
      }
      await page.waitForTimeout(1000);
      trace.push({ ...(await snapshot(page, "after-ok-force-click")), okCount, okClickError });

      // The body text said "...then NEXT to continue" — this report likely
      // shares the same underlying template as the already-working "New
      // Members" report, whose Next button has a stable, verified id
      // (#ctl00_cpMain_btnNext). Try that exact id before falling back to
      // a generic text search.
      const nextById = page.locator("#ctl00_cpMain_btnNext");
      const nextByText = page.locator("button, a").filter({ hasText: /^next$/i }).first();
      const nextBtn = (await nextById.count()) > 0 ? nextById : nextByText;
      const nextCount = await nextBtn.count();
      let nextClickError: string | null = null;
      if (nextCount > 0) {
        const urlBefore = page.url();
        try {
          await nextBtn.click({ force: true, timeout: 5000 });
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

      // Mirror the known-working Campaign -> VIEW DATA -> OK -> (already
      // clicked Next above) sequence from the New Members report, in case
      // this one also routes through a Report Destination modal.
      const campaignBtn = page.locator("button, a").filter({ hasText: /^campaign$/i }).first();
      if ((await campaignBtn.count()) > 0) {
        await campaignBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        const viewDataOption = page.getByText(/^view data$/i).first();
        if ((await viewDataOption.count()) > 0) {
          await viewDataOption.click({ force: true }).catch(() => {});
          const modalOk = page.locator("button", { hasText: /^OK$/ }).first();
          if ((await modalOk.count()) > 0) {
            await modalOk.click({ force: true }).catch(() => {});
            await page.waitForTimeout(800);
          }
        }
        const urlBefore2 = page.url();
        if ((await page.locator("#ctl00_cpMain_btnNext").count()) > 0) {
          await page
            .locator("#ctl00_cpMain_btnNext")
            .click({ force: true })
            .catch(() => {});
          try {
            await page.waitForFunction((prev) => window.location.href !== prev, urlBefore2, { timeout: 8000 });
          } catch {
            await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          }
        }
        trace.push(await snapshot(page, "after-campaign-modal-attempt"));
      }
    });

    return NextResponse.json({ trace });
  } catch (err) {
    const errorMessage = err instanceof AshbourneConnectorError ? `[${err.step}] ${err.message}` : err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: errorMessage, trace }, { status: 500 });
  }
}
