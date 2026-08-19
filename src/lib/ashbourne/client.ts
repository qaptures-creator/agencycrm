import "server-only";
import { chromium, type Browser, type Page } from "playwright";
import { getAshbourneConfig, type AshbourneConfig } from "./config";
import { AshbourneConnectorError } from "./types";

/**
 * Browser lifecycle for the Ashbourne BI connector. A fresh headless
 * Chromium instance is launched per sync run and always closed in a
 * `finally` — this is a low-frequency, admin-triggered operation (manual
 * "Sync Now", or later a scheduled job every few hours), not something
 * that needs a persistent browser held open between requests.
 *
 * --no-sandbox / --disable-dev-shm-usage are standard requirements for
 * running Chromium inside a container (Railway's build/runtime image).
 */

const NAV_TIMEOUT_MS = 30_000;

function redact(message: string, cfg: AshbourneConfig): string {
  return cfg.password ? message.split(cfg.password).join("[redacted]") : message;
}

export async function withAshbourneBrowser<T>(fn: (page: Page, cfg: AshbourneConfig) => Promise<T>): Promise<T> {
  const cfg = getAshbourneConfig();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({ ignoreHTTPSErrors: false });
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    return await fn(page, cfg);
  } catch (err) {
    if (err instanceof AshbourneConnectorError) throw err;
    const message = err instanceof Error ? err.message : "Unknown Ashbourne connector error";
    throw new AshbourneConnectorError("browser", redact(message, cfg));
  } finally {
    // Always close, even on success — nothing here should ever be left
    // running after a sync completes.
    if (browser) await browser.close().catch(() => {});
  }
}

/** Captures a screenshot for diagnostics when a step fails unexpectedly —
 * never includes the password (it's never typed into anything visible on
 * screen as plaintext beyond the password field itself, which renders as
 * dots). Returns null if the screenshot itself fails. */
export async function captureDebugScreenshot(page: Page): Promise<string | null> {
  try {
    const buffer = await page.screenshot({ fullPage: false });
    return buffer.toString("base64");
  } catch {
    return null;
  }
}
