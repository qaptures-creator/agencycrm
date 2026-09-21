import { NextResponse } from "next/server";
import { withAshbourneBrowser } from "@/lib/ashbourne/client";
import { loginToAshbourne } from "@/lib/ashbourne/auth";
import { AshbourneConnectorError } from "@/lib/ashbourne/types";

export const dynamic = "force-dynamic";

/** TEMPORARY — read-only against Ashbourne (login + navigate only, no
 * report submission, no data changes). Looking for a report other than
 * "New Members (All)" that actually carries live membership status/type,
 * since that one only has Member No/First Name/Surname/Mobile/Email/Club
 * Info Date. Deleted right after use.
 *
 * Usage: ?url=<full report/page URL> navigates there after login and
 * dumps visible links + (if present) a results grid's header row. With no
 * ?url, dumps the post-login landing page's visible links instead, to
 * find a reports menu. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const targetUrl = new URL(req.url).searchParams.get("url");

  try {
    const result = await withAshbourneBrowser(async (page, cfg) => {
      await loginToAshbourne(page, cfg);

      if (targetUrl) {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      }

      // The dashboard menu turned out not to be plain <a> tags rendered at
      // domcontentloaded — give any client-side rendering a moment, then
      // cast a much wider net than just <a href>.
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      const title = await page.title().catch(() => null);

      const links = await page
        .locator("a")
        .evaluateAll((els) =>
          els
            .map((el) => ({ text: el.textContent?.trim() ?? "", href: (el as HTMLAnchorElement).href }))
            .filter((l) => l.text.length > 0)
        );

      // Anything clickable-looking that isn't a plain <a> — buttons, divs
      // with onclick/role=button, list items — common in older ASP.NET
      // menu widgets.
      const clickables = await page
        .locator('button, [onclick], [role="button"], li, .menu-item, .nav-item')
        .evaluateAll((els) =>
          els
            .map((el) => ({
              tag: el.tagName.toLowerCase(),
              text: el.textContent?.trim().slice(0, 80) ?? "",
              onclick: el.getAttribute("onclick"),
              id: el.id || null,
            }))
            .filter((l) => l.text.length > 0 && l.text.length < 80)
        );

      const iframeSrcs = await page.locator("iframe").evaluateAll((els) => els.map((el) => (el as HTMLIFrameElement).src));

      const bodyText = await page
        .locator("body")
        .innerText()
        .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 3000))
        .catch(() => "");

      // De-dupe identical text+href/onclick pairs (menus often render
      // twice for responsive layouts).
      const seen = new Set<string>();
      const uniqueLinks = links.filter((l) => {
        const key = `${l.text}::${l.href}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const seenClickables = new Set<string>();
      const uniqueClickables = clickables.filter((c) => {
        const key = `${c.tag}::${c.text}::${c.onclick ?? ""}`;
        if (seenClickables.has(key)) return false;
        seenClickables.add(key);
        return true;
      });

      // If a results grid happens to be present on this page already,
      // grab its header row too — costs nothing if there isn't one.
      let gridHeaders: string[] | null = null;
      const gridLocator = page.locator("#ctl00_cpMain_gvReport");
      if ((await gridLocator.count()) > 0) {
        const headerCells = await gridLocator.locator("tr").first().locator("th, td").allTextContents();
        gridHeaders = headerCells.map((h) => h.trim());
      }

      return { currentUrl, title, links: uniqueLinks, clickables: uniqueClickables, iframeSrcs, bodyText, gridHeaders };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AshbourneConnectorError) {
      return NextResponse.json({ error: `[${err.step}] ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown error" }, { status: 500 });
  }
}
