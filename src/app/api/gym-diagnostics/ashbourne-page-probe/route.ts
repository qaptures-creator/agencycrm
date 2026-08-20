import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { getAshbourneConfig } from "@/lib/ashbourne/config";
import { loginToAshbourne } from "@/lib/ashbourne/auth";

/** TEMPORARY — read-only. Checks whether the "20 found" result is a
 * pagination cutoff, a narrow date-range cutoff, or something else. Never
 * touches Prisma. Logs only counts/booleans and min/max dates (not names,
 * emails, or phone numbers). Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const cfg = getAshbourneConfig();
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(20_000);

    await loginToAshbourne(page, cfg);
    await page.goto(cfg.memberReportUrl, { waitUntil: "domcontentloaded" });

    const preFilterBodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 200);

    const filterBtn = page.getByRole("button", { name: /^filter$/i }).first();
    let dateRangeText: string | null = null;
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(500);
      // Capture whatever date is currently marked "active"/selected in each calendar.
      dateRangeText = await page
        .locator(".modal.show, [class*='modal'][class*='show']")
        .first()
        .innerText()
        .catch(() => null);
      const applyBtn = page.getByRole("button", { name: /^apply$/i }).first();
      if (await applyBtn.isVisible().catch(() => false)) {
        await applyBtn.click();
        await page.waitForTimeout(500);
      }
    }

    const campaignBtn = page.getByRole("button", { name: /^campaign$/i }).first();
    await campaignBtn.click();
    await page.waitForTimeout(500);
    await page.getByText(/^view data$/i).first().click();
    await page.getByRole("button", { name: /^ok$/i }).first().click();
    await page.waitForTimeout(500);

    const nextBtn = page.locator("#ctl00_cpMain_btnNext");
    const urlBeforeNext = page.url();
    await nextBtn.click();
    try {
      await page.waitForFunction((prev) => window.location.href !== prev, urlBeforeNext, { timeout: 15_000 });
    } catch {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    }

    const recordsFoundLocator = page.locator("#ctl00_cpMain_lblRecordsFound");
    const recordsFoundText = (await recordsFoundLocator.count()) > 0 ? (await recordsFoundLocator.first().innerText().catch(() => "")).trim() : null;

    const gridLocator = page.locator("#ctl00_cpMain_gvReport");
    const totalRows = await gridLocator.locator("tr").count();
    const memberRows = await gridLocator.locator("tr.gridCell").count();

    // Look for an ASP.NET GridView pager row — usually the last <tr> in the
    // table, containing page-number links/postback controls, not gridCell.
    const lastRowHtml = totalRows > 0 ? await gridLocator.locator("tr").last().innerHTML().catch(() => "") : "";
    const pagerLikely = /doPostBack|Page\$|pagination|pager/i.test(lastRowHtml);
    const pagerLinkTexts = await gridLocator
      .locator("tr")
      .last()
      .locator("a")
      .allTextContents()
      .catch(() => []);

    // Column header positions + min/max Club Info Date among returned rows
    // (dates only, no names/emails/phones) to check whether results skew old.
    const headerCells = memberRows > 0 ? await gridLocator.locator("tr").first().locator("th, td").allTextContents() : [];
    const headers = headerCells.map((h) => h.trim());
    const dateColIdx = headers.findIndex((h) => /club\s*info\s*date|joined/i.test(h));
    let minDate: string | null = null;
    let maxDate: string | null = null;
    if (dateColIdx >= 0) {
      const dates: string[] = [];
      for (let i = 0; i < memberRows; i++) {
        const cells = await gridLocator.locator("tr.gridCell").nth(i).locator("td").allTextContents();
        const raw = cells[dateColIdx]?.trim();
        if (raw) dates.push(raw);
      }
      dates.sort();
      minDate = dates[0] ?? null;
      maxDate = dates[dates.length - 1] ?? null;
    }

    return NextResponse.json({
      preFilterBodyTextSnippet: preFilterBodyText,
      activeDateRangeModalText: dateRangeText,
      recordsFoundText,
      totalTableRows: totalRows,
      memberRows,
      pagerRowLikely: pagerLikely,
      pagerLinkTexts,
      headers,
      dateColumnFound: dateColIdx >= 0,
      minDateAmongResults: minDate,
      maxDateAmongResults: maxDate,
      database: { changed: false },
    });
  } catch (err) {
    return NextResponse.json({ fatalError: err instanceof Error ? err.message : "unknown error", database: { changed: false } });
  } finally {
    await browser.close().catch(() => {});
  }
}
