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

      const currentUrl = page.url();
      const title = await page.title().catch(() => null);

      const links = await page
        .locator("a")
        .evaluateAll((els) =>
          els
            .map((el) => ({ text: el.textContent?.trim() ?? "", href: (el as HTMLAnchorElement).href }))
            .filter((l) => l.text.length > 0)
        );

      // De-dupe identical text+href pairs (menus often render twice for
      // responsive layouts).
      const seen = new Set<string>();
      const uniqueLinks = links.filter((l) => {
        const key = `${l.text}::${l.href}`;
        if (seen.has(key)) return false;
        seen.add(key);
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

      return { currentUrl, title, links: uniqueLinks, gridHeaders };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AshbourneConnectorError) {
      return NextResponse.json({ error: `[${err.step}] ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "unknown error" }, { status: 500 });
  }
}
