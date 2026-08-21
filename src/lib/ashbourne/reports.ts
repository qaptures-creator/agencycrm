import "server-only";
import type { Page } from "playwright";
import type { AshbourneConfig } from "./config";
import type { AshbourneFetchResult } from "./types";
import { AshbourneConnectorError } from "./types";
import { captureDebugScreenshot } from "./client";
import { rowsToMembers } from "./parser";

/**
 * Retrieves members from Ashbourne's "New Members (All)" report — a
 * multi-step ASP.NET WebForms wizard, confirmed against the real site
 * (2026-08-20 diagnostic probe), not guessed:
 *
 *  1. Land on the report config page (memberReportUrl) — shows a
 *     pre-computed count and Filter/Campaign/Next controls.
 *  2. "Filter" opens a date-range modal; "Apply" closes it (uses whatever
 *     range is currently set — see the module comment on date-range
 *     handling below for why this isn't customized yet).
 *  3. "Campaign" opens a "Report Destination" modal — a set of radio
 *     options (SMS/PUSH/EMAIL/EXPORT/VIEW DATA/E-Mail Template). Selecting
 *     "VIEW DATA" and clicking "OK" is what closes this modal — a fully
 *     confirmed step from a debug screenshot showing exactly what it
 *     failed on: the modal was still open and physically intercepted the
 *     next click, aborting the whole run with an empty result.
 *  4. The "Next >>" button (verified id: ctl00_cpMain_btnNext) submits and
 *     navigates to campaignscreen.aspx, which renders the real results
 *     grid at the verified id ctl00_cpMain_gvReport, with data rows
 *     matching tr.gridCell.
 *
 * The previous version of this file guessed at a generic "Run/Search/View
 * Report" button and a generic `table` selector — neither exists on the
 * real page, so it silently stayed on the config page and picked up an
 * unrelated `<table>` element elsewhere on it, returning an empty member
 * list without ever throwing. That's why Dry Run was reporting "success"
 * with Found: 0. Every step below throws a specific, named
 * AshbourneConnectorError if its expected control isn't found, rather than
 * silently falling through — and a genuinely empty results grid is treated
 * as a failure (see the bottom of fetchAshbourneMembers), not a normal
 * zero-record sync, since Ashbourne is expected to always have current
 * members.
 *
 * Pagination (confirmed against the real site, 2026-08-21 diagnostic
 * probe): the grid's last <tr> is a pager row with numbered links (an ASP.NET
 * GridView postback pager, e.g. page "164 found" / 20 per page = 9 pages).
 * A prior version of this connector only ever read page 1 — proven by that
 * probe to return the *oldest* 20 records in the active range, not the
 * newest, since Ashbourne apparently returns them oldest-first. That's why
 * recently-joined members were missing even though the report's total count
 * already covered them. Every page's numbered link is clicked in turn until
 * no link for the next page number exists.
 *
 * Not yet implemented: setting a custom date range before "Apply" (this
 * accepts whatever range the report already has active — the diagnostic
 * probe confirmed the active range's total already includes recent joins,
 * so this hasn't been needed yet).
 */

const MAX_GRID_PAGES = 200; // safety cap against an unexpected infinite pagination loop

async function withDebugScreenshot(page: Page, step: string, message: string): Promise<AshbourneConnectorError> {
  const debug = await captureDebugScreenshot(page);
  const error = new AshbourneConnectorError(step, message);
  (error as AshbourneConnectorError & { debugScreenshotBase64?: string | null }).debugScreenshotBase64 = debug;
  return error;
}

export async function fetchAshbourneMembers(page: Page, cfg: AshbourneConfig): Promise<AshbourneFetchResult> {
  try {
    await page.goto(cfg.memberReportUrl, { waitUntil: "domcontentloaded" });
  } catch (err) {
    throw new AshbourneConnectorError("navigate-report", `Could not reach the report URL: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  // --- Step: Filter -> Apply (accepts the report's current date range) ---
  const filterBtn = page.getByRole("button", { name: /^filter$/i }).first();
  const filterVisible = await filterBtn.isVisible().catch(() => false);
  if (filterVisible) {
    await filterBtn.click();
    await page.waitForTimeout(500);
    const applyBtn = page.getByRole("button", { name: /^apply$/i }).first();
    const applyVisible = await applyBtn.isVisible().catch(() => false);
    if (applyVisible) {
      await applyBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // --- Step: Campaign -> select "VIEW DATA" -> OK ---
  const campaignBtn = page.getByRole("button", { name: /^campaign$/i }).first();
  const campaignVisible = await campaignBtn.isVisible().catch(() => false);
  if (!campaignVisible) {
    throw await withDebugScreenshot(page, "campaign-button-not-found", "Could not find the 'Campaign' button on the report config page — the page layout may have changed.");
  }
  await campaignBtn.click();
  await page.waitForTimeout(500);

  const viewDataOption = page.getByText(/^view data$/i).first();
  const viewDataVisible = await viewDataOption.isVisible().catch(() => false);
  if (!viewDataVisible) {
    throw await withDebugScreenshot(page, "view-data-option-not-found", "Could not find the 'VIEW DATA' campaign destination option in the Report Destination modal.");
  }
  await viewDataOption.click();

  const okBtn = page.getByRole("button", { name: /^ok$/i }).first();
  const okVisible = await okBtn.isVisible().catch(() => false);
  if (!okVisible) {
    throw await withDebugScreenshot(page, "campaign-ok-not-found", "Selected 'VIEW DATA' but couldn't find the OK button to confirm the Report Destination modal.");
  }
  await okBtn.click();
  await page.waitForTimeout(500);

  // --- Step: Next >> -> submit -> navigate to campaignscreen.aspx ---
  const nextBtn = page.locator("#ctl00_cpMain_btnNext");
  const nextVisible = await nextBtn.isVisible().catch(() => false);
  if (!nextVisible) {
    throw await withDebugScreenshot(page, "next-button-not-found", "Could not find the report's Next button (#ctl00_cpMain_btnNext) — the Report Destination modal may still be open and blocking it.");
  }
  const urlBeforeNext = page.url();
  await nextBtn.click();
  try {
    await page.waitForFunction((prevUrl) => window.location.href !== prevUrl, urlBeforeNext, { timeout: 15_000 });
  } catch {
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  }

  // --- Results: verified real grid, not a generic `table` guess ---
  const gridLocator = page.locator("#ctl00_cpMain_gvReport");
  const gridExists = (await gridLocator.count()) > 0;
  if (!gridExists) {
    throw await withDebugScreenshot(
      page,
      "results-grid-not-found",
      `Expected the results grid (#ctl00_cpMain_gvReport) after submitting the report, but it wasn't there. Final URL: ${page.url()}`
    );
  }

  const headerCells = await gridLocator.locator("tr").first().locator("th, td").allTextContents();
  const headers = headerCells.map((h) => h.trim());

  const allRows: string[][] = [];
  let pageNum = 1;
  while (pageNum <= MAX_GRID_PAGES) {
    const rowLocator = gridLocator.locator("tr.gridCell");
    const rowCount = await rowLocator.count();
    for (let i = 0; i < rowCount; i++) {
      const cells = await rowLocator.nth(i).locator("td").allTextContents();
      if (cells.length > 0) allRows.push(cells.map((c) => c.trim()));
    }

    // The pager is the grid's last row — an ASP.NET GridView postback
    // pager with a plain-text (non-link) current page and numbered links
    // for every other page. Stop once there's no link for the next number.
    const pagerRow = gridLocator.locator("tr").last();
    const nextPageLink = pagerRow.getByRole("link", { name: String(pageNum + 1), exact: true }).first();
    const hasNextPage = await nextPageLink.isVisible().catch(() => false);
    if (!hasNextPage) break;

    // This is an ASP.NET UpdatePanel-style partial postback — the URL never
    // changes, so waitForLoadState("networkidle") has no reliable signal to
    // key off and just burns its full timeout on every page turn if the
    // site has any background polling. Instead, watch the grid's first
    // data cell for its text to actually change, which is fast (usually
    // well under a second) and doesn't depend on network-level heuristics.
    const firstCellBefore = await rowLocator.first().locator("td").first().innerText().catch(() => "");
    await nextPageLink.click();
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const firstCellNow = await gridLocator.locator("tr.gridCell").first().locator("td").first().innerText().catch(() => "");
      if (firstCellNow && firstCellNow !== firstCellBefore) break;
      await page.waitForTimeout(150);
    }
    pageNum++;
  }

  const members = rowsToMembers(allRows, headers);

  // Ashbourne is expected to always have current members — an empty result
  // here means something's wrong upstream (wrong filter, wrong report
  // state, a markup change), not a legitimately empty sync. Fail loudly
  // instead of reporting a false "success".
  if (members.length === 0) {
    throw await withDebugScreenshot(
      page,
      "zero-records-retrieved",
      `Reached the results page (${page.url()}) but the grid returned 0 member rows across ${pageNum} page(s) (${headers.length} columns). Treating this as a failure rather than a valid empty sync.`
    );
  }

  return { members, method: "grid-scrape", debug: { reportUrl: cfg.memberReportUrl, columnsFound: headers } };
}
