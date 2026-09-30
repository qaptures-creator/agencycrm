/**
 * Pure "what counts as a genuine ongoing membership" business rules — no
 * database, no server-only guard, safe to import from anywhere including
 * tests. See membership-kpis.ts for the Prisma-backed aggregate functions
 * that use these.
 *
 * Business rule (as specified): a membership is "active" only if its type
 * is one of the three genuine ongoing plans AND its status is one of the
 * four in-force Ashbourne statuses. Day Pass/PAYG/Cash Membership Temp
 * never count, regardless of status.
 */

export const ACTIVE_MEMBERSHIP_TYPES = ["12 Month Contract", "Presale Membership", "Rolling Membership"] as const;
export const ACTIVE_MEMBERSHIP_STATUSES = ["Live", "New", "Defaulter", "Paid in Full"] as const;
export const DAY_PASS_TYPE = "Day Pass";
export const EXCLUDED_MEMBERSHIP_TYPES = ["Day Pass", "PAYG", "Cash Membership Temp"] as const;

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

const ACTIVE_TYPES_NORMALIZED = new Set(ACTIVE_MEMBERSHIP_TYPES.map(normalize));
const ACTIVE_STATUSES_NORMALIZED = new Set(ACTIVE_MEMBERSHIP_STATUSES.map(normalize));
const DAY_PASS_NORMALIZED = normalize(DAY_PASS_TYPE);

/** Is this membership type one of the three genuine ongoing plans?
 * Whitespace/case differences ("Paid in Full" vs "Paid In Full") are
 * tolerated; genuinely unrecognized types are never silently mapped in. */
export function isActiveMembershipType(type: string | null | undefined): boolean {
  return ACTIVE_TYPES_NORMALIZED.has(normalize(type));
}

/** Is this status one of the four in-force Ashbourne statuses? */
export function isActiveMembershipStatus(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES_NORMALIZED.has(normalize(status));
}

/** The full "Active Members" business rule for one membership. */
export function isActiveMembership(input: { membershipType: string | null | undefined; status: string | null | undefined }): boolean {
  return isActiveMembershipType(input.membershipType) && isActiveMembershipStatus(input.status);
}

/** Is this membership type exactly "Day Pass"? */
export function isDayPassType(type: string | null | undefined): boolean {
  return normalize(type) === DAY_PASS_NORMALIZED;
}

/**
 * Ashbourne's live exports use ALL CAPS ("12 MONTH CONTRACT", "LIVE") while
 * everything above compares against Title Case. Prisma's `in` filter can't
 * do case-insensitive array matching, so rather than special-case every
 * query, values are normalized to a single canonical casing once, at sync
 * write time (see ashbourne/sync.ts) — every query above then works as a
 * plain exact match, with no risk of a "found the bug, forgot a query"
 * repeat of the case-sensitivity bug this replaced.
 */
const CANONICAL_MEMBERSHIP_TYPES: Record<string, string> = Object.fromEntries(
  [...ACTIVE_MEMBERSHIP_TYPES, ...EXCLUDED_MEMBERSHIP_TYPES, "1 Month Paid In Full", "1 Year Paid In Full", "Cash Membership - Day Pass"].map((t) => [normalize(t), t])
);

/** Maps a raw Ashbourne membership type string to its canonical Title Case
 * form when recognized; unrecognized values are returned Title Cased on a
 * best-effort basis rather than left ALL CAPS, so at least new/future
 * membership types created in Ashbourne render consistently in the UI. */
export function canonicalizeMembershipType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = normalize(raw);
  if (CANONICAL_MEMBERSHIP_TYPES[key]) return CANONICAL_MEMBERSHIP_TYPES[key];
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const CANONICAL_STATUSES: Record<string, string> = Object.fromEntries(
  ["Live", "New", "DD Presale", "DD Hold", "Defaulter", "Final", "Paid In Full", "Complete", "Freeze", "Expired", "Prospects", "Indefinite Hold"].map((s) => [normalize(s), s])
);

/** Same canonicalization for the raw Ashbourne Status column, stored as-is
 * on GymMember.ashbourneStatus for reference/debugging — the CRM's own
 * GymMembership.status (ACTIVE/FROZEN/EXPIRED) is computed separately, see
 * deriveMembershipStatus below. */
export function canonicalizeAshbourneStatus(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = normalize(raw);
  return CANONICAL_STATUSES[key] ?? raw;
}

/**
 * The single shared function every dashboard/Membership Snapshot metric
 * reads a membership's CRM status from (Step 2 of the Ashbourne membership-
 * accuracy plan) — computed from dates every time it's called, not trusted
 * from a stored field that can go stale between syncs.
 *
 *  - Frozen: Ashbourne's own Status is the only signal available for this —
 *    the "All Members" export has no separate freeze-start/freeze-end
 *    columns, so there are no dates to derive it from.
 *  - Active: startDate has arrived and endDate hasn't passed (or there is
 *    no endDate at all — a rolling membership).
 *  - Expired: endDate has passed.
 *  - Cancelled is deliberately not produced here — Ashbourne's export has
 *    no cancellation signal (no "Cancelled" status value, no cancelled-at
 *    date), so cancelledAt/CANCELLED remains a CRM-manual-only concept,
 *    never set or cleared by a sync.
 */
export function deriveMembershipStatus(input: {
  ashbourneStatus?: string | null;
  startDate: Date | null;
  endDate: Date | null;
  today?: Date;
}): "ACTIVE" | "FROZEN" | "EXPIRED" {
  const today = input.today ?? new Date();
  if (normalize(input.ashbourneStatus) === "freeze") return "FROZEN";

  if (input.endDate && input.endDate.getTime() < today.getTime()) return "EXPIRED";
  if (input.startDate && input.startDate.getTime() <= today.getTime()) return "ACTIVE";

  // No usable startDate, or a startDate still in the future (e.g. a
  // presale that hasn't kicked in yet) — Ashbourne's own Status is the
  // fallback signal rather than guessing from incomplete dates.
  return normalize(input.ashbourneStatus) === "expired" ? "EXPIRED" : "ACTIVE";
}
