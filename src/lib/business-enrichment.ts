// Best-effort Instagram discovery: fetch a business's own website (server
// side, through the SSRF guard) and scan the HTML for a real profile link.
// Never invents an account — returns null if nothing confident is found.
//
// Structured as a single exported findInstagram(url) so a future provider
// (e.g. a paid enrichment API) can be swapped in or added alongside this
// without touching callers.

import { safeExternalFetch, readTextCapped, SsrfBlockedError } from "@/lib/ssrf-guard";

const MAX_HTML_BYTES = 500_000; // header/footer/contact links are always near the top of the document
const CANDIDATE_PATHS = ["", "/contact", "/contact-us", "/about"];
const IGNORED_PATH_PREFIXES = ["/p/", "/reel/", "/reels/", "/tv/", "/stories/", "/explore/", "/accounts/", "/share", "/direct/"];
const IGNORED_HANDLES = new Set(["sharer", "intent", "share", "home", "login", "about"]);

export type InstagramMatch = { url: string; handle: string };

function extractInstagramLinks(html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']*instagram\.com[^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html))) links.push(match[1]);
  return links;
}

function normalizeInstagramLink(raw: string, baseUrl: string): InstagramMatch | null {
  let url: URL;
  try {
    url = new URL(raw, baseUrl);
  } catch {
    return null;
  }
  if (url.hostname.replace(/^www\./, "").toLowerCase() !== "instagram.com") return null;

  const path = url.pathname.replace(/\/+$/, "");
  if (!path) return null;
  const lowerPath = (path + "/").toLowerCase();
  if (IGNORED_PATH_PREFIXES.some((p) => lowerPath.startsWith(p))) return null;

  const handle = path.split("/").filter(Boolean)[0];
  if (!handle || IGNORED_HANDLES.has(handle.toLowerCase())) return null;
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;

  return { url: `https://www.instagram.com/${handle}/`, handle: `@${handle}` };
}

/** Fetches a business's website and a couple of likely pages, looking for a real Instagram profile link. Returns null if none found — never guesses. */
export async function findInstagram(websiteUrl: string): Promise<InstagramMatch | null> {
  let base: URL;
  try {
    base = new URL(websiteUrl);
  } catch {
    return null;
  }

  for (const path of CANDIDATE_PATHS) {
    const pageUrl = new URL(path, base).toString();
    try {
      const res = await safeExternalFetch(pageUrl, {
        timeoutMs: 5000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PRMOTEBot/1.0; +https://prmote.co.uk)" },
      });
      if (!res.ok) continue;
      if (!(res.headers.get("content-type") || "").includes("text/html")) continue;

      const html = await readTextCapped(res, MAX_HTML_BYTES);
      for (const link of extractInstagramLinks(html)) {
        const normalized = normalizeInstagramLink(link, pageUrl);
        if (normalized) return normalized;
      }
    } catch (err) {
      // A blocked (private/internal) host means every path on this domain
      // would be blocked too — stop instead of retrying the others.
      if (err instanceof SsrfBlockedError) return null;
      // Timeout/network error on this one page — try the next candidate path.
    }
  }
  return null;
}
