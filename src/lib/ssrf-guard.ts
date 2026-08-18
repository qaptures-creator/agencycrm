// Shared outbound-fetch guard for anything that fetches a URL we don't
// control (a prospect's business website, a Google-hosted photo). Resolves
// DNS ourselves and blocks private/internal/loopback addresses so this
// can't be used to reach Railway's internal network or localhost — the
// classic SSRF path for a "fetch this URL for me" feature. Re-validates on
// every redirect hop for the same reason (a public URL can still 302 to an
// internal one).

import { lookup } from "node:dns/promises";
import net from "node:net";

export class SsrfBlockedError extends Error {}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return false;
  }
  return true; // unrecognized format — fail closed
}

async function assertPublicHost(hostname: string) {
  if (hostname.toLowerCase() === "localhost") throw new SsrfBlockedError("Refusing to fetch localhost");
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new SsrfBlockedError("Refusing to fetch a private/internal address");
    return;
  }
  let address: string;
  try {
    address = (await lookup(hostname)).address;
  } catch {
    throw new SsrfBlockedError(`Could not resolve "${hostname}"`);
  }
  if (isPrivateIp(address)) throw new SsrfBlockedError("Refusing to fetch a private/internal address");
}

export type SafeFetchOptions = RequestInit & { timeoutMs?: number };

/** fetch() that validates the URL scheme/host (and every redirect hop) before each request. */
export async function safeExternalFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 6000, ...init } = options;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("Invalid URL");
  }

  let redirectsLeft = 5;
  for (;;) {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new SsrfBlockedError("Only http/https URLs are allowed");
    }
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url.toString(), { ...init, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || redirectsLeft-- <= 0) return res;
      url = new URL(location, url);
      continue;
    }
    return res;
  }
}

/** Reads a Response body as text, aborting once maxBytes is exceeded (avoids downloading huge pages just to grep them). */
export async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        chunks.push(value);
        if (total >= maxBytes) break;
      }
    }
  } finally {
    reader.releaseLock?.();
    await res.body.cancel?.().catch(() => {});
  }
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)), Math.min(total, maxBytes));
  return buffer.toString("utf-8");
}
