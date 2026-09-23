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

  const trace: Awaited<ReturnType<typeof snapshot>>[] = [];

  try {
    await withAshbourneBrowser(async (page, cfg) => {
      await loginToAshbourne(page, cfg);

      await page.goto(ALL_MEMBERS_REPORT_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      trace.push(await snapshot(page, "loaded-report-page"));

      // Dismiss the filter side panel via its OK button, accepting
      // whatever's already selected (every checkbox appeared ticked by
      // default when we looked at this page, matching the pre-filter
      // "2309 members" count).
      const okBtn = page.getByRole("button", { name: /^ok$/i }).first();
      if (await okBtn.isVisible().catch(() => false)) {
        await okBtn.click();
        await page.waitForTimeout(1000);
        trace.push(await snapshot(page, "after-ok"));
      } else {
        trace.push(await snapshot(page, "no-ok-button-found"));
      }

      // From here the flow is unknown — look for whatever the most
      // likely "proceed" control is among common labels, up to two
      // rounds, snapshotting after each so the trace shows exactly what
      // was clicked and what happened.
      const candidateLabels = [/^campaign$/i, /^next$/i, /^search$/i, /^run$/i, /^go$/i, /^generate$/i, /^view$/i, /^export$/i];

      for (let round = 0; round < 2; round++) {
        let clicked = false;
        for (const label of candidateLabels) {
          const btn = page.getByRole("button", { name: label }).first();
          if (await btn.isVisible().catch(() => false)) {
            const urlBefore = page.url();
            await btn.click();
            await page.waitForTimeout(800);

            // If this opened a modal with a "VIEW DATA" style option
            // (same pattern as the existing New Members report), pick it
            // and confirm with OK.
            const viewDataOption = page.getByText(/^view data$/i).first();
            if (await viewDataOption.isVisible().catch(() => false)) {
              await viewDataOption.click();
              const modalOk = page.getByRole("button", { name: /^ok$/i }).first();
              if (await modalOk.isVisible().catch(() => false)) {
                await modalOk.click();
                await page.waitForTimeout(800);
              }
            }

            try {
              await page.waitForFunction((prev) => window.location.href !== prev, urlBefore, { timeout: 8000 });
            } catch {
              await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
            }

            trace.push(await snapshot(page, `after-click-${label.source}`));
            clicked = true;
            break;
          }
        }
        if (!clicked) break;
        // Stop early once a grid shows up.
        if (trace[trace.length - 1]?.gridHeaders) break;
      }
    });

    return NextResponse.json({ trace });
  } catch (err) {
    const errorMessage = err instanceof AshbourneConnectorError ? `[${err.step}] ${err.message}` : err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: errorMessage, trace }, { status: 500 });
  }
}
