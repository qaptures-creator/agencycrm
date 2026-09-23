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

      // Two prior attempts both failed on Playwright's mouse-coordinate
      // click mechanics (first the wrong element, a not-yet-open modal;
      // then "outside of the viewport" on the × — the off-canvas panel is
      // apparently positioned somewhere Playwright's synthetic mouse can't
      // reach even after scrolling). Sidestepping all of that: call the
      // panel's own onclick handler directly via evaluate (native JS call,
      // no mouse/viewport involved at all), and use native DOM .click()
      // (element.click(), not Playwright's mouse simulation) for every
      // subsequent step for the same reason.
      const closePanelResult = await page
        .evaluate(() => {
          const w = window as unknown as { closeNav?: (id: string) => void };
          if (typeof w.closeNav === "function") {
            w.closeNav("filterPanel");
            return "called";
          }
          return "closeNav-not-a-function";
        })
        .catch((err) => `evaluate-threw: ${err instanceof Error ? err.message : String(err)}`);
      await page.waitForTimeout(800);
      trace.push({ ...(await snapshot(page, "after-close-panel")), closePanelResult });

      async function nativeClick(selector: string): Promise<string> {
        const loc = page.locator(selector).first();
        if ((await loc.count()) === 0) return "not-found";
        try {
          await loc.evaluate((el) => (el as HTMLElement).click());
          return "clicked";
        } catch (err) {
          return `threw: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      async function nativeClickByText(tag: string, text: RegExp): Promise<string> {
        const loc = page.locator(tag).filter({ hasText: text }).first();
        if ((await loc.count()) === 0) return "not-found";
        try {
          await loc.evaluate((el) => (el as HTMLElement).click());
          return "clicked";
        } catch (err) {
          return `threw: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      const urlBeforeNext = page.url();
      const nextResult =
        (await page.locator("#ctl00_cpMain_btnNext").count()) > 0
          ? await nativeClick("#ctl00_cpMain_btnNext")
          : await nativeClickByText("button, a", /^next$/i);
      try {
        await page.waitForFunction((prev) => window.location.href !== prev, urlBeforeNext, { timeout: 8000 });
      } catch {
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      }
      trace.push({ ...(await snapshot(page, "after-next")), nextResult });

      // If that revealed a Report Destination-style modal (mirroring the
      // New Members report's Campaign -> VIEW DATA -> OK -> Next), repeat
      // the same native-click approach through it.
      const viewDataLoc = page.getByText(/^view data$/i).first();
      const hasViewData = (await viewDataLoc.count()) > 0;
      if (hasViewData) {
        let viewDataResult = "not-found";
        try {
          await viewDataLoc.evaluate((el) => (el as HTMLElement).click());
          viewDataResult = "clicked";
        } catch (err) {
          viewDataResult = `threw: ${err instanceof Error ? err.message : String(err)}`;
        }
        const modalOkResult = await nativeClickByText("button", /^OK$/);
        await page.waitForTimeout(800);
        const urlBeforeNext2 = page.url();
        const next2Result = (await page.locator("#ctl00_cpMain_btnNext").count()) > 0 ? await nativeClick("#ctl00_cpMain_btnNext") : "not-found";
        try {
          await page.waitForFunction((prev) => window.location.href !== prev, urlBeforeNext2, { timeout: 8000 });
        } catch {
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        }
        trace.push({ ...(await snapshot(page, "after-view-data-modal")), viewDataResult, modalOkResult, next2Result });
      }
    });

    return NextResponse.json({ trace });
  } catch (err) {
    const errorMessage = err instanceof AshbourneConnectorError ? `[${err.step}] ${err.message}` : err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: errorMessage, trace }, { status: 500 });
  }
}
