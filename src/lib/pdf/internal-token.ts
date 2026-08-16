import { randomUUID, createHash, timingSafeEqual } from "node:crypto";

export const PDF_INTERNAL_TOKEN_HEADER = "x-pdf-internal-token";

// The token only ever needs to match within this one running process: the
// PDF route sets it on its own internal request, and the print route checks
// it on the way in. Generating it once per process means there's nothing to
// configure and nothing that could leak between deployments or environments.
// PDF_INTERNAL_SECRET can still be set explicitly if you'd rather pin it.
//
// Next.js bundles each route handler and page into its own module graph, so
// a plain module-level `const` is NOT a reliable process-wide singleton —
// the route and the print page can each end up with their own copy. `
// process.env`, on the other hand, is a genuine Node.js process global, so
// we lazily self-assign the secret there on first use instead.
function getSecret(): string {
  if (!process.env.PDF_INTERNAL_SECRET) {
    process.env.PDF_INTERNAL_SECRET = randomUUID();
  }
  return process.env.PDF_INTERNAL_SECRET;
}

export function getPdfInternalToken(): string {
  return getSecret();
}

export function isValidPdfInternalToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(getSecret()).digest();
  return timingSafeEqual(a, b);
}
