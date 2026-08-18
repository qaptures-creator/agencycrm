// Tiny in-process cache for Business Finder's Google-backed endpoints.
// Railway runs this app as one persistent container (not per-request
// serverless instances), so a module-level Map is genuinely effective here
// — same pattern already used for the warm Puppeteer browser singleton in
// src/lib/pdf/browser.ts. Purely a cost/latency optimization: correctness
// never depends on a cache hit.

type Entry<T> = { value: T; expiresAt: number };

class TtlCache<T> {
  private store = new Map<string, Entry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number) {
    // Cheap unbounded-growth guard — this cache is never load-bearing.
    if (this.store.size > 500) this.store.clear();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

export const searchCache = new TtlCache<unknown>();
export const enrichCache = new TtlCache<unknown>();
