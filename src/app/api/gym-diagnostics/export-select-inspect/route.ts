import { NextResponse } from "next/server";
import { withAshbourneBrowser } from "@/lib/ashbourne/client";
import { loginToAshbourne } from "@/lib/ashbourne/auth";
import { AshbourneConnectorError } from "@/lib/ashbourne/types";

/** TEMPORARY — read-only against Ashbourne (navigates + clicks through the
 * exact same flow as fetchAshbourneAllMembersCsv up to campaignexport.aspx,
 * but stops BEFORE touching the File Type dropdown to inspect why a real
 * user's dry run saw it disabled for 30+ seconds — something this session's
 * own prior test run never hit). Never submits a campaign action, never
 * writes to our own DB. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const result = await withAshbourneBrowser(async (page, cfg) => {
      await loginToAshbourne(page, cfg);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(cfg.allMembersReportUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        for (const box of boxes) {
          if (!box.checked) {
            box.checked = true;
            box.dispatchEvent(new Event("change", { bubbles: true }));
            box.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      });

      async function nativeClick(selector: string) {
        const loc = page.locator(selector).first();
        if ((await loc.count()) === 0) return false;
        await loc.evaluate((el) => (el as HTMLElement).click());
        return true;
      }

      await nativeClick("#ctl00_cpMain_btnApply");
      await page.waitForTimeout(800);

      const urlBeforeNext1 = page.url();
      await nativeClick("#ctl00_cpMain_btnNext");
      try {
        await page.waitForFunction((prev) => window.location.href !== prev, urlBeforeNext1, { timeout: 8000 });
      } catch {
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      }

      const exportOption = page.getByText(/^export$/i).first();
      await exportOption.evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(300);
      await nativeClick("button:has-text('OK')");
      await page.waitForTimeout(800);

      const urlBeforeNext2 = page.url();
      await nativeClick("#ctl00_cpMain_btnNext");
      try {
        await page.waitForFunction((prev) => window.location.href !== prev, urlBeforeNext2, { timeout: 8000 });
      } catch {
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      }
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(800);

      // --- Inspection only — never touch the select ---
      const url = page.url();
      const selectState = await page
        .locator("#ctl00_cpMain_dlExport")
        .evaluate((el) => {
          const sel = el as HTMLSelectElement;
          return { disabled: sel.disabled, outerHTML: sel.outerHTML.slice(0, 800), value: sel.value };
        })
        .catch((err) => `evaluate-threw: ${err instanceof Error ? err.message : String(err)}`);

      // Dump every input/button/radio/checkbox near the select, plus their
      // onclick/onchange attributes — something likely toggles .disabled.
      const nearbyControls = await page.evaluate(() => {
        const controls = Array.from(document.querySelectorAll("input, select, button"));
        return controls.map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || null,
          id: el.id || null,
          name: (el as HTMLInputElement).name || null,
          disabled: (el as HTMLInputElement).disabled ?? null,
          checked: (el as HTMLInputElement).checked ?? null,
          onclick: el.getAttribute("onclick"),
          onchange: el.getAttribute("onchange"),
          value: (el as HTMLInputElement).value ?? null,
        }));
      });

      // Full page HTML around the export form, to catch any JS enabling
      // logic in an inline <script> block too.
      const scripts = await page.locator("script:not([src])").evaluateAll((els) => els.map((e) => e.textContent?.slice(0, 2000) ?? "").filter((t) => /dlExport|disabled/i.test(t)));

      // Poll for up to 15s to see if it EVER becomes enabled on its own.
      let becameEnabledAfterMs: number | null = null;
      const pollStart = Date.now();
      while (Date.now() - pollStart < 15000) {
        const stillDisabled = await page.locator("#ctl00_cpMain_dlExport").evaluate((el) => (el as HTMLSelectElement).disabled);
        if (!stillDisabled) {
          becameEnabledAfterMs = Date.now() - pollStart;
          break;
        }
        await page.waitForTimeout(500);
      }

      return { url, selectState, nearbyControls, relevantScripts: scripts, becameEnabledAfterMs };
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof AshbourneConnectorError ? `[${err.step}] ${err.message}` : err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
