import { NextResponse } from "next/server";
import { chromium, type Page } from "playwright";
import { getAshbourneConfig } from "@/lib/ashbourne/config";
import { loginToAshbourne } from "@/lib/ashbourne/auth";

/** TEMPORARY — read-only diagnostic probe. Never touches Prisma, never
 * creates/updates/deletes a GymMember. Purely inspects what the real
 * Ashbourne report workflow does at each stage so the actual bug in
 * fetchAshbourneMembers() can be proven rather than guessed. Never logs
 * credentials, cookies, ViewState/EventValidation, or member PII — only
 * URLs, titles, booleans, and counts. Deleted right after use. */

type StepLog = { step: string; ok: boolean; detail: string };

async function visibleControlsSummary(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("button, a, input[type=submit], input[type=button]"));
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => (el.textContent || (el as HTMLInputElement).value || "").trim())
      .filter((t) => t.length > 0)
      .slice(0, 40);
  });
}

export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const cfg = getAshbourneConfig();
  const steps: StepLog[] = [];
  const log = (step: string, ok: boolean, detail: string) => steps.push({ step, ok, detail });

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  const result: Record<string, unknown> = { steps, database: { changed: false } };

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(20_000);

    // --- Checkpoint 1: Authentication ---
    const initialUrl = cfg.baseUrl;
    let authConfirmed = false;
    let urlAfterLogin = "";
    let titleAfterLogin = "";
    try {
      await loginToAshbourne(page, cfg);
      authConfirmed = true;
      urlAfterLogin = page.url();
      titleAfterLogin = await page.title();
      log("authentication", true, "login confirmed (password field no longer visible)");
    } catch (err) {
      urlAfterLogin = page.url();
      titleAfterLogin = await page.title().catch(() => "");
      log("authentication", false, err instanceof Error ? err.message : "unknown login error");
    }
    result.authentication = { initialUrl, urlAfterLogin, titleAfterLogin, authConfirmed };

    if (!authConfirmed) {
      return NextResponse.json(result);
    }

    // --- Checkpoint 2: Report navigation ---
    await page.goto(cfg.memberReportUrl, { waitUntil: "domcontentloaded" });
    const urlAfterNav = page.url();
    const titleAfterNav = await page.title();
    const bodyTextAfterNav = (await page.locator("body").innerText().catch(() => "")).slice(0, 300);
    result.reportNavigation = { configuredUrl: cfg.memberReportUrl, urlAfterNav, titleAfterNav, bodyTextSnippet: bodyTextAfterNav };
    log("report-navigation", true, `landed on ${urlAfterNav}`);

    const controlsOnConfigPage = await visibleControlsSummary(page);
    result.controlsOnConfigPage = controlsOnConfigPage;

    // --- Checkpoint 3: VIEW DATA workflow ---
    const workflow: Record<string, unknown> = {};

    // Step: Filter -> Apply (accept default date range for this probe; the
    // point here is proving the pipeline mechanics reach real results, not
    // yet fetching the full historical range).
    try {
      const filterBtn = page.getByRole("button", { name: /^filter$/i }).first();
      const filterVisible = await filterBtn.isVisible().catch(() => false);
      if (filterVisible) {
        await filterBtn.click();
        await page.waitForTimeout(600);
        const applyBtn = page.getByRole("button", { name: /^apply$/i }).first();
        const applyVisible = await applyBtn.isVisible().catch(() => false);
        if (applyVisible) {
          await applyBtn.click();
          await page.waitForTimeout(600);
          log("filter-apply", true, "clicked Filter then Apply");
        } else {
          log("filter-apply", false, "Filter opened but no Apply control found");
        }
      } else {
        log("filter-apply", false, "no Filter button visible on config page");
      }
    } catch (err) {
      log("filter-apply", false, err instanceof Error ? err.message : "unknown error");
    }
    workflow.urlAfterFilter = page.url();

    // Step: Campaign -> select VIEW DATA destination
    try {
      const campaignBtn = page.getByRole("button", { name: /^campaign$/i }).first();
      const campaignVisible = await campaignBtn.isVisible().catch(() => false);
      if (campaignVisible) {
        await campaignBtn.click();
        await page.waitForTimeout(600);
        const controlsAfterCampaign = await visibleControlsSummary(page);
        workflow.controlsAfterCampaign = controlsAfterCampaign;

        const viewDataOption = page.getByText(/view\s*data/i).first();
        const viewDataVisible = await viewDataOption.isVisible().catch(() => false);
        if (viewDataVisible) {
          await viewDataOption.click();
          await page.waitForTimeout(400);
          log("select-view-data", true, "clicked a VIEW DATA control");
        } else {
          log("select-view-data", false, "no 'VIEW DATA' text/control found after clicking Campaign");
        }
      } else {
        log("campaign-step", false, "no Campaign button visible on config page");
        workflow.controlsAfterCampaign = [];
      }
    } catch (err) {
      log("campaign-step", false, err instanceof Error ? err.message : "unknown error");
    }
    workflow.urlAfterCampaignAndViewData = page.url();

    // Step: Continue / Next -> submit
    try {
      const continueBtn = page.getByRole("button", { name: /^(continue|next\s*>>|next)$/i }).first();
      const continueVisible = await continueBtn.isVisible().catch(() => false);
      if (continueVisible) {
        const urlBefore = page.url();
        await continueBtn.click();
        try {
          await page.waitForFunction((prev) => window.location.href !== prev, urlBefore, { timeout: 10_000 });
        } catch {
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        }
        log("continue-submit", true, "clicked Continue/Next and waited for navigation");
      } else {
        log("continue-submit", false, "no Continue/Next control found");
      }
    } catch (err) {
      log("continue-submit", false, err instanceof Error ? err.message : "unknown error");
    }

    const finalUrl = page.url();
    const finalTitle = await page.title().catch(() => "");
    const reachedCampaignScreen = /campaignscreen\.aspx/i.test(finalUrl);
    workflow.finalUrl = finalUrl;
    workflow.finalTitle = finalTitle;
    workflow.reachedCampaignScreen = reachedCampaignScreen;
    result.viewDataWorkflow = workflow;
    log("reached-campaignscreen", reachedCampaignScreen, `finalUrl=${finalUrl}`);

    // --- Checkpoint 4: Results table detection (verified real selectors) ---
    const recordsFoundLocator = page.locator("#ctl00_cpMain_lblRecordsFound");
    const recordsFoundElementExists = (await recordsFoundLocator.count()) > 0;
    const recordsFoundText = recordsFoundElementExists ? (await recordsFoundLocator.first().innerText().catch(() => "")).trim() : null;

    const gridLocator = page.locator("#ctl00_cpMain_gvReport");
    const tableExists = (await gridLocator.count()) > 0;
    const totalTableRows = tableExists ? await gridLocator.locator("tr").count() : 0;
    const gridCellRows = tableExists ? await gridLocator.locator("tr.gridCell").count() : 0;

    result.resultsTable = {
      recordsFoundElementExists,
      recordsFoundText,
      tableExists,
      totalTableRows,
      memberRows: gridCellRows,
    };
    log("results-table-detection", tableExists, `tableExists=${tableExists} totalRows=${totalTableRows} gridCellRows=${gridCellRows}`);

    // Fallback: also check for ANY table on the final page, in case the ID
    // differs from what was verified manually (e.g. different report id).
    const anyTableCount = await page.locator("table").count();
    result.anyTablesOnFinalPage = anyTableCount;

    // --- Checkpoint 5: Parsing (structural only, no PII) ---
    let htmlRowsDiscovered = 0;
    let rowsParsed = 0;
    let rowsRejectedNoMemberNo = 0;
    if (tableExists && gridCellRows > 0) {
      const headerCells = await gridLocator.locator("tr").first().locator("th, td").allTextContents();
      const memberNoColIdx = headerCells.findIndex((h) => /member\s*no/i.test(h.trim()));
      htmlRowsDiscovered = gridCellRows;
      for (let i = 0; i < gridCellRows; i++) {
        const cells = await gridLocator.locator("tr.gridCell").nth(i).locator("td").allTextContents();
        const memberNo = memberNoColIdx >= 0 ? cells[memberNoColIdx]?.trim() : undefined;
        if (memberNo) rowsParsed++;
        else rowsRejectedNoMemberNo++;
      }
    }
    result.parsing = { htmlRowsDiscovered, rowsParsed, rowsRejectedNoMemberNo, normalisedMemberCount: rowsParsed };
    log("parsing", htmlRowsDiscovered > 0, `discovered=${htmlRowsDiscovered} parsed=${rowsParsed} rejected=${rowsRejectedNoMemberNo}`);

    // Debug artifact only if zero records — screenshot only, no HTML/PII dump.
    if (rowsParsed === 0) {
      const shot = await page.screenshot({ fullPage: true }).catch(() => null);
      result.debugScreenshotBase64 = shot ? shot.toString("base64") : null;
    }

    return NextResponse.json(result);
  } catch (err) {
    result.fatalError = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(result, { status: 200 });
  } finally {
    await browser.close().catch(() => {});
  }
}
