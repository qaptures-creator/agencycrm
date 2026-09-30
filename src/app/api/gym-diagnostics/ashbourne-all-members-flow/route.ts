import { NextResponse } from "next/server";
import type { Page } from "playwright";
import { withAshbourneBrowser } from "@/lib/ashbourne/client";
import { loginToAshbourne } from "@/lib/ashbourne/auth";
import { AshbourneConnectorError } from "@/lib/ashbourne/types";

export const dynamic = "force-dynamic";

const ALL_MEMBERS_REPORT_URL = "https://secure.ashbournemanagement.co.uk/bi/dashboard/reports/reportmembership.aspx?id=1";

async function snapshot(page: Page, label: string) {
  const url = page.url();
  // Blind spot found in earlier attempts: this selector never matched
  // input[type=submit]/input[type=button] — which is exactly what the
  // real working "Next" control turned out to be. text/value both checked
  // since a submit input's visible label is its `value` attribute, not
  // textContent.
  const buttons = await page
    .locator('button, a, input[type="submit"], input[type="button"], [onclick], [role="button"]')
    .evaluateAll((els) =>
      els
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent?.trim() || (el as HTMLInputElement).value || "").slice(0, 60),
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
    .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 3000))
    .catch(() => "");

  const iframeSrcs = await page.locator("iframe").evaluateAll((els) => els.map((el) => (el as HTMLIFrameElement).src || "(no src)"));

  const viewport = page.viewportSize();

  const checkboxes = await page.locator('input[type="checkbox"]').evaluateAll((els) => {
    const list = els as HTMLInputElement[];
    return { total: list.length, checked: list.filter((c) => c.checked).length };
  });

  let gridHeaders: string[] | null = null;
  const gridLocator = page.locator("#ctl00_cpMain_gvReport");
  if ((await gridLocator.count()) > 0) {
    const headerCells = await gridLocator.locator("tr").first().locator("th, td").allTextContents();
    gridHeaders = headerCells.map((h) => h.trim());
  }

  return { label, url, viewport, buttons: uniqueButtons, iframeSrcs, checkboxes, bodyText, gridHeaders };
}

/** outerHTML (truncated) of the first element matching a selector — for
 * confirming a "clicked successfully, nothing happened" result isn't
 * secretly landing on a decoy/hidden duplicate. */
async function describeElement(page: Page, selector: string): Promise<string | null> {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return null;
  return loc
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return JSON.stringify({
        outerHTML: el.outerHTML.slice(0, 300),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: style.display,
        visibility: style.visibility,
      });
    })
    .catch((err) => `evaluate-threw: ${err instanceof Error ? err.message : String(err)}`);
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

  // Breakthrough (attempt 11): the real Apply click finally produced a live
  // results grid — but it only exposes 5 columns (Member No, First Name,
  // Surname, Mobile, Email), no Status/Membership Type/Expiry Date, despite
  // those being the exact filter used. Before concluding that's a hard
  // ceiling, test whether the EXPORT destination (the other radio option in
  // the same modal, described on the report category page as a "Full
  // membership report") produces a downloadable file with a fuller column
  // set instead. ?destination=export selects it; default stays "view".
  const url = new URL(req.url);
  const destination = url.searchParams.get("destination") === "export" ? "export" : "view";

  const trace: Record<string, unknown>[] = [];

  try {
    await withAshbourneBrowser(async (page, cfg) => {
      await loginToAshbourne(page, cfg);

      // Three prior attempts all failed on interaction mechanics, and the
      // 2nd's error was literally "outside of the viewport" — Playwright's
      // default context viewport is 1280x720, which may just be too small
      // for this dashboard's off-canvas panel positioning. Try a real
      // desktop size before anything else.
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.goto(ALL_MEMBERS_REPORT_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      trace.push(await snapshot(page, "loaded-report-page"));

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

      // Attempt 9 proved checking exactly one Status checkbox ("LIVE")
      // instead of all 22 still reaches the same genuinely empty "View
      // Only" summary page server-side — the "select-all = no filter"
      // theory is dead. New theory: every attempt so far has closed the
      // filter panel by calling window.closeNav('filterPanel') directly
      // via evaluate() — never by actually clicking the real "Apply"
      // button. Apply's onclick attribute is the literal same string
      // ("closeNav('filterPanel');") as the × close button, but Apply
      // could still have an ADDITIONAL listener bound via
      // addEventListener/jQuery (invisible in the onclick attribute) that
      // saves the selected filter state server-side — something calling
      // closeNav() directly would skip entirely. Test: check the box FIRST,
      // then click the real Apply button natively instead of evaluating
      // closeNav.
      const checkboxState = await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        const before = boxes.filter((c) => c.checked).length;
        const target = boxes.find((b) => {
          const label = b.closest("label")?.textContent?.trim() || document.querySelector(`label[for="${b.id}"]`)?.textContent?.trim() || "";
          return label.toUpperCase() === "LIVE";
        });
        if (target && !target.checked) {
          target.checked = true;
          target.dispatchEvent(new Event("change", { bubbles: true }));
          target.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const after = boxes.filter((c) => c.checked).length;
        return { total: boxes.length, checkedBefore: before, checkedAfter: after, targetFound: !!target, targetId: target?.id ?? null };
      });

      const applyBtnDesc = await describeElement(page, "#ctl00_cpMain_btnApply");
      const applyResult = await nativeClick("#ctl00_cpMain_btnApply");
      await page.waitForTimeout(800);
      trace.push({ ...(await snapshot(page, "after-apply")), applyResult, applyBtnDesc, checkboxState });

      const nextBtnDesc = await describeElement(page, "#ctl00_cpMain_btnNext");
      const urlBeforeNext = page.url();

      // The dead-end "View Only ALL MEMBERS SUMMARY" confirmation page with
      // a blank "Records Found:" count and only a "Home" button smells like
      // a "View Data"-style action that opens its real results in a new
      // browser tab/popup rather than rendering inline (a common pattern for
      // enterprise reporting UIs, and one nothing here has watched for yet).
      // Listen for any new page opened on this context around the Next
      // click and every subsequent click below.
      const popups: Page[] = [];
      const context = page.context();
      const onNewPage = (p: Page) => popups.push(p);
      context.on("page", onNewPage);

      const nextResult =
        (await page.locator("#ctl00_cpMain_btnNext").count()) > 0
          ? await nativeClick("#ctl00_cpMain_btnNext")
          : await nativeClickByText("button, a", /^next$/i);
      try {
        await page.waitForFunction((prev) => window.location.href !== prev, urlBeforeNext, { timeout: 8000 });
      } catch {
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      }
      await page.waitForTimeout(500); // let any popup actually open before we check
      trace.push({ ...(await snapshot(page, "after-next")), nextResult, nextBtnDesc, checkboxState, popupCountSoFar: popups.length });

      // If that revealed a Report Destination-style modal (mirroring the
      // New Members report's Campaign -> VIEW DATA -> OK -> Next), repeat
      // the same native-click approach through it. destination=export picks
      // the EXPORT radio instead of VIEW DATA, and a download listener is
      // armed around the whole sequence in case EXPORT triggers a file
      // download rather than another confirmation page.
      const destinationLabel = destination === "export" ? /^export$/i : /^view data$/i;
      const viewDataLoc = page.getByText(destinationLabel).first();
      const hasViewData = (await viewDataLoc.count()) > 0;
      let downloadInfo: Record<string, unknown> | null = null;
      if (hasViewData) {
        const downloadPromise = destination === "export" ? page.waitForEvent("download", { timeout: 15000 }).catch(() => null) : null;
        // Before touching anything: dump every radio option in whatever
        // modal/container "View Data" lives in — the New Members report's
        // Report Destination modal has SMS/PUSH/EMAIL/EXPORT/VIEW
        // DATA/E-Mail Template options, but the All Members report might
        // expose a different set (or the text match might be landing on a
        // different element entirely than the intended radio option),
        // which would explain a "View Only" result instead of real data.
        const modalRadios = await page.evaluate(() => {
          const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
          return radios.map((r) => ({
            name: r.name,
            value: r.value,
            id: r.id,
            checked: r.checked,
            labelText: (r.closest("label")?.textContent || document.querySelector(`label[for="${r.id}"]`)?.textContent || "").trim(),
          }));
        });
        const viewDataElementDesc = await viewDataLoc
          .evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return JSON.stringify({ tag: el.tagName.toLowerCase(), outerHTML: el.outerHTML.slice(0, 300), rect: { x: rect.x, y: rect.y } });
          })
          .catch((err) => `evaluate-threw: ${err instanceof Error ? err.message : String(err)}`);

        let viewDataResult = "not-found";
        try {
          await viewDataLoc.evaluate((el) => (el as HTMLElement).click());
          viewDataResult = "clicked";
        } catch (err) {
          viewDataResult = `threw: ${err instanceof Error ? err.message : String(err)}`;
        }
        await page.waitForTimeout(300);
        const modalRadiosAfterClick = await page.evaluate(() => {
          const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
          return radios.map((r) => ({ name: r.name, value: r.value, id: r.id, checked: r.checked }));
        });

        const modalOkResult = await nativeClickByText("button", /^OK$/);
        await page.waitForTimeout(800);
        const urlBeforeNext2 = page.url();
        const next2Result = (await page.locator("#ctl00_cpMain_btnNext").count()) > 0 ? await nativeClick("#ctl00_cpMain_btnNext") : "not-found";
        try {
          await page.waitForFunction((prev) => window.location.href !== prev, urlBeforeNext2, { timeout: 8000 });
        } catch {
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        }

        let exportScreenInfo: Record<string, unknown> | null = null;

        // campaignexport.aspx turned out to be its own mini-wizard: choose a
        // File Type (Excel/CSV vs Adobe/PDF), click "Export" (#btnRun) to
        // generate the file, then click "DOWNLOAD" (#btnDownload) to
        // actually trigger the browser download — the single Next click
        // above only gets you to this page, not to a downloaded file.
        if (destination === "export" && page.url().includes("campaignexport.aspx")) {
          const fileTypeOptions = await page.evaluate(() => {
            const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
            const selects = Array.from(document.querySelectorAll("select"));
            return {
              radios: radios.map((r) => ({
                name: r.name,
                value: r.value,
                id: r.id,
                checked: r.checked,
                labelText: (r.closest("label")?.textContent || document.querySelector(`label[for="${r.id}"]`)?.textContent || "").trim(),
              })),
              selects: selects.map((s) => ({ id: s.id, name: s.name, options: Array.from(s.options).map((o) => o.text) })),
            };
          });

          // The downloaded "file" from the first attempt turned out to be
          // the same page's HTML re-rendered, not a real export — because
          // clicking the visible "Excel/CSV" <option> text doesn't actually
          // select it in a headless browser (native <select> dropdowns are
          // OS-level popups; a raw DOM click on the <option> element doesn't
          // reliably update .value or fire change the way a real user
          // interaction would). Use selectOption() instead, which drives
          // the underlying <select> correctly.
          let fileTypeResult = "not-found";
          const exportSelect = page.locator("#ctl00_cpMain_dlExport");
          if ((await exportSelect.count()) > 0) {
            try {
              await exportSelect.selectOption({ label: "Excel/CSV" });
              fileTypeResult = "selected-excel-csv";
            } catch (err) {
              fileTypeResult = `threw: ${err instanceof Error ? err.message : String(err)}`;
            }
          }
          const fileTypeAfter = await exportSelect
            .evaluate((el) => ({ value: (el as HTMLSelectElement).value, selectedText: (el as HTMLSelectElement).selectedOptions[0]?.text }))
            .catch(() => null);
          // ASP.NET dropdowns often have AutoPostBack — give any partial
          // postback triggered by the selection itself time to settle
          // before touching Export/Download.
          await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(500);

          const runResult = await nativeClick("#ctl00_cpMain_btnRun");
          await page.waitForTimeout(1500);
          const afterRunDesc = await describeElement(page, "#ctl00_cpMain_btnDownload");

          const downloadPromise2 = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
          const downloadClickResult = await nativeClick("#ctl00_cpMain_btnDownload");
          const download = await downloadPromise2;
          if (download) {
            const suggestedFilename = download.suggestedFilename();
            const savePath = `/tmp/ashbourne-export-${Date.now()}-${suggestedFilename}`;
            await download.saveAs(savePath).catch(() => {});
            const fs = await import("fs/promises");
            const buf = await fs.readFile(savePath).catch(() => null);
            const text = buf ? buf.toString("utf8").slice(0, 3000) : null;
            downloadInfo = { suggestedFilename, savePath, byteLength: buf?.length ?? null, textPreview: text };
          } else {
            downloadInfo = { result: "no-download-event-after-download-click" };
          }

          exportScreenInfo = { fileTypeOptions, fileTypeResult, fileTypeAfter, runResult, afterRunDesc, downloadClickResult };
        } else if (downloadPromise) {
          const download = await downloadPromise;
          if (download) {
            const suggestedFilename = download.suggestedFilename();
            const savePath = `/tmp/ashbourne-export-${Date.now()}-${suggestedFilename}`;
            await download.saveAs(savePath).catch(() => {});
            const fs = await import("fs/promises");
            const buf = await fs.readFile(savePath).catch(() => null);
            const text = buf ? buf.toString("utf8").slice(0, 3000) : null;
            downloadInfo = { suggestedFilename, savePath, byteLength: buf?.length ?? null, textPreview: text };
          } else {
            downloadInfo = { result: "no-download-event-within-timeout" };
          }
        }

        trace.push({
          ...(await snapshot(page, "after-view-data-modal")),
          viewDataResult,
          modalOkResult,
          next2Result,
          downloadInfo,
          exportScreenInfo,
          modalRadios,
          modalRadiosAfterClick,
          viewDataElementDesc,
        });
      }

      // Landed on campaignscreen.aspx ("... SUMMARY / Campaign Type: View
      // Only / Filter Applied: NOT FILTERED / Records Found: ...") — the
      // same URL the working New Members report's real grid lives on, but
      // this looks like an intermediate confirmation step, not the grid
      // itself. The previous buttons scan had a blind spot for
      // input[type=submit]/button, now fixed — look again with a longer
      // settle time and click whatever proceed-shaped control exists.
      if (page.url().includes("campaignscreen.aspx") && !(await page.locator("#ctl00_cpMain_gvReport").count())) {
        // "Records Found:" showed up blank in attempt 7 even after a 1.2s
        // settle — poll for up to 5s in case it's populated by an async
        // postback rather than being present on initial render.
        let recordsFoundText = "";
        const pollDeadline = Date.now() + 5000;
        while (Date.now() < pollDeadline) {
          recordsFoundText = await page
            .locator("body")
            .innerText()
            .then((t) => {
              const m = t.match(/Records Found:\s*(\S*)/i);
              return m ? m[1] : "";
            })
            .catch(() => "");
          if (recordsFoundText) break;
          await page.waitForTimeout(400);
        }

        // Dump the raw HTML of the main content area — if there's an error
        // message, a hidden count, or something else useful, it'll be in
        // here even if it's not part of the plain-text body content. The
        // 4000-char version cut off right after "Filter Applied", before
        // ever reaching "Records Found" — this report might also use a
        // different grid element ID than #ctl00_cpMain_gvReport (which
        // belongs to the New Members report specifically), so also scan
        // for ANY table/grid-shaped element on the page regardless of id.
        const mainContentHtml = await page
          .locator("#ctl00_cpMain, .container, main")
          .first()
          .evaluate((el) => el.innerHTML.slice(0, 12000))
          .catch((err) => `evaluate-threw: ${err instanceof Error ? err.message : String(err)}`);

        const anyTables = await page.locator("table").evaluateAll((tables) =>
          tables.map((t) => ({
            id: t.id || null,
            className: t.className || null,
            rowCount: t.querySelectorAll("tr").length,
            firstRowText: t.querySelector("tr")?.textContent?.trim().slice(0, 200) || "",
          }))
        );

        const summarySnapshot = await snapshot(page, "campaignscreen-summary");
        trace.push({ ...summarySnapshot, recordsFoundText, mainContentHtml, anyTables });

        const candidateLabels = [/^next$/i, /^run$/i, /^go$/i, /^view$/i, /^confirm$/i, /^continue$/i, /^generate$/i, /^submit$/i, /^ok$/i];
        for (const label of candidateLabels) {
          const loc = page.locator('button, a, input[type="submit"], input[type="button"]').filter({ hasText: label }).first();
          if ((await loc.count()) > 0) {
            const urlBefore3 = page.url();
            let clickResult = "not-found";
            try {
              await loc.evaluate((el) => (el as HTMLElement).click());
              clickResult = "clicked";
            } catch (err) {
              clickResult = `threw: ${err instanceof Error ? err.message : String(err)}`;
            }
            try {
              await page.waitForFunction((prev) => window.location.href !== prev, urlBefore3, { timeout: 8000 });
            } catch {
              await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
            }
            trace.push({ ...(await snapshot(page, `after-summary-click-${label.source}`)), clickResult });
            break;
          }
        }
      }

      // Final check: did any of the clicks above open a new tab/popup? Give
      // it a moment to finish navigating, then snapshot every popup page
      // (best-effort — a popup can be a plain new tab of the same origin, a
      // report-viewer iframe host page, or even a file download that never
      // finishes loading as a normal page).
      await page.waitForTimeout(1500);
      context.off("page", onNewPage);
      const popupSnapshots: Record<string, unknown>[] = [];
      for (let i = 0; i < popups.length; i++) {
        const popup = popups[i];
        try {
          await popup.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
          popupSnapshots.push({ index: i, ...(await snapshot(popup, `popup-${i}`)) });
        } catch (err) {
          popupSnapshots.push({ index: i, error: err instanceof Error ? err.message : String(err) });
        }
      }
      trace.push({ label: "popup-check", popupCount: popups.length, popupSnapshots });
    });

    return NextResponse.json({ trace });
  } catch (err) {
    const errorMessage = err instanceof AshbourneConnectorError ? `[${err.step}] ${err.message}` : err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: errorMessage, trace }, { status: 500 });
  }
}
