import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { getAshbourneConfig } from "@/lib/ashbourne/config";

/** TEMPORARY — captures what the real Ashbourne login page looks like and
 * what happens after a login attempt, so the connector's field-detection
 * logic can be fixed against real markup instead of guesses. Never logs or
 * returns the password. Deleted right after use. */
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
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(30_000);

    await page.goto(cfg.baseUrl, { waitUntil: "domcontentloaded" });
    const beforeUrl = page.url();
    const beforeTitle = await page.title();
    const beforeScreenshot = (await page.screenshot({ fullPage: true })).toString("base64");

    const inputsBefore = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input")).map((el) => ({
        type: el.type,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }))
    );

    let afterUrl: string | null = null;
    let afterTitle: string | null = null;
    let afterScreenshot: string | null = null;
    let submitError: string | null = null;

    try {
      const passwordField = page.locator('input[type="password"]').first();
      const usernameField = page.locator('input[type="text"], input[type="email"]').first();
      await usernameField.fill(cfg.username);
      await passwordField.fill(cfg.password);
      const urlBeforeSubmit = page.url();
      await passwordField.press("Enter");
      try {
        await page.waitForFunction((prevUrl) => window.location.href !== prevUrl, urlBeforeSubmit, { timeout: 8_000 });
      } catch {
        await passwordField.waitFor({ state: "hidden", timeout: 8_000 }).catch(() => {});
      }
      afterUrl = page.url();
      afterTitle = await page.title();
      afterScreenshot = (await page.screenshot({ fullPage: true })).toString("base64");
    } catch (err) {
      submitError = err instanceof Error ? err.message : "unknown submit error";
    }

    return NextResponse.json({
      before: { url: beforeUrl, title: beforeTitle, inputs: inputsBefore, screenshotBase64: beforeScreenshot },
      after: { url: afterUrl, title: afterTitle, screenshotBase64: afterScreenshot },
      submitError,
    });
  } finally {
    await browser.close().catch(() => {});
  }
}
