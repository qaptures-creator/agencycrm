import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";

// Railway's Nixpacks build has no system Chromium and no reliable apt/nix
// package name we can pin ahead of time, so in production we use
// @sparticuz/chromium — a self-contained Chromium binary bundled in the npm
// package itself (no OS packages to install). Locally (or anywhere a real
// browser is already available, e.g. this sandbox's Playwright Chromium),
// set PUPPETEER_EXECUTABLE_PATH to skip sparticuz entirely.
async function launchBrowser(): Promise<Browser> {
  const overridePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (overridePath) {
    return puppeteer.launch({
      executablePath: overridePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
    args: chromium.args,
  });
}

// One warm Chromium process reused across requests — this app runs as a
// persistent Railway container, not a per-request lambda, so paying the
// ~1-2s launch cost on every PDF click would be wasteful. Each caller opens
// and closes its own `page`; only the browser process itself is shared.
let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}
