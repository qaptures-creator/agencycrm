import "server-only";
import type { Page } from "playwright";
import type { AshbourneConfig } from "./config";
import type { AshbourneFetchResult, AshbourneMember } from "./types";
import { AshbourneConnectorError } from "./types";
import { captureDebugScreenshot } from "./client";
import { parseCsvExport, rowsToMembers } from "./parser";

const MAX_GRID_PAGES = 200; // safety cap against an infinite pagination loop

async function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Tries the report's export control first (gets the full dataset in one
 * shot, sidestepping WebForms pagination entirely) — only CSV-shaped
 * exports are parsed; anything else (e.g. a binary XLSX) is reported back
 * rather than silently mis-parsed. */
async function tryExport(page: Page): Promise<AshbourneMember[] | null> {
  const exportControl = page.getByText(/export/i).first();
  const found = await exportControl.isVisible().catch(() => false);
  if (!found) return null;

  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
  await exportControl.click().catch(() => {});
  const download = await downloadPromise;
  if (!download) return null; // clicking "export" didn't trigger a real download — fall back to scraping

  const filename = download.suggestedFilename();
  const stream = await download.createReadStream();
  if (!stream) return null;
  const buffer = await collectStream(stream);

  const looksBinary = buffer.subarray(0, 2).toString("hex") === "504b"; // PK.. zip signature (xlsx/docx/etc.)
  if (looksBinary || /\.xlsx?$/i.test(filename)) {
    throw new AshbourneConnectorError(
      "export-format-unsupported",
      `Ashbourne's export produced "${filename}", which looks like an Excel file — this connector only parses CSV exports today. Either configure the report to export CSV, or ask for XLSX support to be added.`
    );
  }

  return parseCsvExport(buffer.toString("utf-8"));
}

/** Falls back to scraping the on-page results grid, paging through it via
 * whatever "next page" control the WebForms grid exposes. */
async function scrapeGrid(page: Page): Promise<AshbourneMember[]> {
  const table = page.locator("table").first();
  const tableFound = await table.isVisible().catch(() => false);
  if (!tableFound) {
    const debug = await captureDebugScreenshot(page);
    const error = new AshbourneConnectorError("no-results-table", "No results table found on the report page after running it.");
    (error as AshbourneConnectorError & { debugScreenshotBase64?: string | null }).debugScreenshotBase64 = debug;
    throw error;
  }

  const headerCells = await table.locator("thead th, tr:first-child th, tr:first-child td").allTextContents();
  const headers = headerCells.map((h) => h.trim());
  if (headers.length === 0) {
    throw new AshbourneConnectorError("no-headers-found", "Found a results table but couldn't read any column headers from it.");
  }

  const allRows: string[][] = [];
  let pageIndex = 0;

  while (pageIndex < MAX_GRID_PAGES) {
    const bodyRows = table.locator("tbody tr, tr:not(:first-child)");
    const count = await bodyRows.count();
    for (let i = 0; i < count; i++) {
      const cells = await bodyRows.nth(i).locator("td").allTextContents();
      if (cells.length > 0) allRows.push(cells.map((c) => c.trim()));
    }

    const nextControl = page.getByRole("link", { name: /^next$/i }).first();
    const hasNext = await nextControl.isVisible().catch(() => false);
    if (!hasNext) break;

    const disabled = await nextControl.getAttribute("aria-disabled").catch(() => null);
    if (disabled === "true") break;

    await nextControl.click().catch(() => {
      // Couldn't click "next" — stop here rather than looping forever.
    });
    await page.waitForTimeout(500); // WebForms postback settle time
    pageIndex++;
  }

  return rowsToMembers(allRows, headers);
}

/** Navigates directly to the configured report URL (avoids needing to
 * simulate clicking through an unknown menu structure), runs it if there's
 * a run/search control, and retrieves the member list — export preferred,
 * grid scrape as fallback. */
export async function fetchAshbourneMembers(page: Page, cfg: AshbourneConfig): Promise<AshbourneFetchResult> {
  try {
    await page.goto(cfg.memberReportUrl, { waitUntil: "domcontentloaded" });
  } catch (err) {
    throw new AshbourneConnectorError("navigate-report", `Could not reach the report URL: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  // Some reports need an explicit "Run"/"Search"/"View Report" click before
  // showing results — only click one if it's actually present.
  const runControl = page.getByRole("button", { name: /^(run|search|view report|generate)$/i }).first();
  const hasRunControl = await runControl.isVisible().catch(() => false);
  if (hasRunControl) {
    await runControl.click();
    await page.waitForTimeout(1000);
  }

  const exported = await tryExport(page);
  if (exported) {
    return { members: exported, method: "export", debug: { reportUrl: cfg.memberReportUrl } };
  }

  const scraped = await scrapeGrid(page);
  const headers = await page
    .locator("table")
    .first()
    .locator("thead th, tr:first-child th, tr:first-child td")
    .allTextContents()
    .catch(() => []);
  return { members: scraped, method: "grid-scrape", debug: { reportUrl: cfg.memberReportUrl, columnsFound: headers } };
}
