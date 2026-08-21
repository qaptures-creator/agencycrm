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
