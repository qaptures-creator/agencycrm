import "server-only";
import type { Page } from "playwright";
import type { AshbourneConfig } from "./config";
import { AshbourneConnectorError } from "./types";
import { captureDebugScreenshot } from "./client";

/**
 * Logs into Ashbourne BI. The real login page (confirmed against the live
 * site) has three fields, not the generic two: Club ID, then Username, then
 * Password — Club ID is a plain text input appearing before Username, so a
 * naive "first text field = username" guess fills the wrong box. Detection:
 *
 *  - The password field is located via `input[type="password"]`, which is
 *    reliable regardless of ASP.NET's auto-generated control IDs.
 *  - All visible text/email inputs appearing before the password field are
 *    collected in DOM order. Two fields = [Club ID, Username]. One field =
 *    [Username] only, for any install that turns out not to need a Club ID.
 *  - Submission uses Enter in the password field (submits the form in
 *    virtually every browser/framework) rather than hunting for a specific
 *    submit button selector.
 */
export async function loginToAshbourne(page: Page, cfg: AshbourneConfig): Promise<void> {
  try {
    await page.goto(cfg.baseUrl, { waitUntil: "domcontentloaded" });
  } catch (err) {
    throw new AshbourneConnectorError("navigate-login", `Could not reach ${cfg.baseUrl}: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  const passwordField = page.locator('input[type="password"]').first();
  const passwordVisible = await passwordField.isVisible().catch(() => false);
  if (!passwordVisible) {
    const debug = await captureDebugScreenshot(page);
    const error = new AshbourneConnectorError("login-form-not-found", "No password field found on the Ashbourne login page — the page layout may differ from what this connector expects.");
    (error as AshbourneConnectorError & { debugScreenshotBase64?: string | null }).debugScreenshotBase64 = debug;
    throw error;
  }

  const textFields = page.locator('input[type="text"], input[type="email"]');
  const textFieldCount = await textFields.count();
  if (textFieldCount === 0) {
    throw new AshbourneConnectorError("login-form-not-found", "No username field found on the Ashbourne login page.");
  }

  if (textFieldCount >= 2) {
    await textFields.nth(0).fill(cfg.clubId);
    await textFields.nth(1).fill(cfg.username);
  } else {
    await textFields.nth(0).fill(cfg.username);
  }
  await passwordField.fill(cfg.password);

  const urlBeforeSubmit = page.url();
  await passwordField.press("Enter");

  try {
    await page.waitForFunction((prevUrl) => window.location.href !== prevUrl, urlBeforeSubmit, { timeout: 15_000 });
  } catch {
    // Some WebForms postbacks don't change the URL — fall back to waiting
    // for the password field to disappear instead.
    await passwordField.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  }

  // Confirm login actually succeeded — a password field still visible
  // almost always means invalid credentials or a validation error.
  const stillOnLoginForm = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
  if (stillOnLoginForm) {
    const debug = await captureDebugScreenshot(page);
    const error = new AshbourneConnectorError("login-failed", "Login did not succeed — the password field is still visible after submitting. Check ASHBOURNE_USERNAME/ASHBOURNE_PASSWORD.");
    (error as AshbourneConnectorError & { debugScreenshotBase64?: string | null }).debugScreenshotBase64 = debug;
    throw error;
  }
}
