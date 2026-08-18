// Shared between the API routes and the client UI — keep this framework-free
// (no "use client"/"use server", no Prisma types) so both sides can import it.

export type CrmMatch = { type: "lead" | "client"; id: string; href: string };

export type BusinessResult = {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles: number | null;
  rating: number | null;
  reviewCount: number | null;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  openNow: boolean | null;
  businessStatus: string | null;
  photoUrl: string | null;
  instagram: { url: string; handle: string } | null;
  instagramChecked: boolean;
  crmMatch: CrmMatch | null;
};

export const RADIUS_OPTIONS_MILES = [1, 2, 5, 10, 15, 20, 30] as const;
export type RadiusMiles = (typeof RADIUS_OPTIONS_MILES)[number];

export function parseRadiusMiles(value: unknown): RadiusMiles {
  const n = Number(value);
  return (RADIUS_OPTIONS_MILES as readonly number[]).includes(n) ? (n as RadiusMiles) : 5;
}

export const RATING_FILTERS = [
  { value: "ANY", label: "Any", min: 0 },
  { value: "3", label: "3+", min: 3 },
  { value: "4", label: "4+", min: 4 },
  { value: "4.5", label: "4.5+", min: 4.5 },
] as const;
export type RatingFilterValue = (typeof RATING_FILTERS)[number]["value"];

export const REVIEW_FILTERS = [
  { value: "ANY", label: "Any" },
  { value: "UNDER_25", label: "Under 25" },
  { value: "25_PLUS", label: "25+" },
  { value: "50_PLUS", label: "50+" },
  { value: "100_PLUS", label: "100+" },
  { value: "500_PLUS", label: "500+" },
] as const;
export type ReviewFilterValue = (typeof REVIEW_FILTERS)[number]["value"];

export function passesReviewFilter(count: number | null, filter: ReviewFilterValue): boolean {
  const n = count ?? 0;
  switch (filter) {
    case "UNDER_25":
      return n < 25;
    case "25_PLUS":
      return n >= 25;
    case "50_PLUS":
      return n >= 50;
    case "100_PLUS":
      return n >= 100;
    case "500_PLUS":
      return n >= 500;
    default:
      return true;
  }
}

export const WEBSITE_FILTERS = [
  { value: "ANY", label: "Any" },
  { value: "HAS_WEBSITE", label: "Has Website" },
  { value: "NO_WEBSITE", label: "No Website" },
] as const;
export type WebsiteFilterValue = (typeof WEBSITE_FILTERS)[number]["value"];

export const INSTAGRAM_FILTERS = [
  { value: "ANY", label: "Any" },
  { value: "FOUND", label: "Instagram Found" },
  { value: "NOT_FOUND", label: "Instagram Not Found" },
] as const;
export type InstagramFilterValue = (typeof INSTAGRAM_FILTERS)[number]["value"];

export const CRM_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "NOT_IN_CRM", label: "Not In CRM" },
  { value: "IN_CRM", label: "Already In CRM" },
] as const;
export type CrmFilterValue = (typeof CRM_FILTERS)[number]["value"];

export const SORT_OPTIONS = [
  { value: "BEST_PROSPECT", label: "Best prospect" },
  { value: "DISTANCE", label: "Distance" },
  { value: "RATING", label: "Google rating" },
  { value: "REVIEWS", label: "Review count" },
  { value: "NAME", label: "Business name" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Deterministic, transparent "best prospect" score — NOT an AI/ML score.
 * One point each for: has phone, has website, has Instagram, isn't already
 * in the CRM, and has a meaningful Google presence (4+ rating with 10+
 * reviews). Range 0-5, higher = worth contacting first. Tune the weights
 * here if your priorities change — there's nothing more clever going on.
 */
export function bestProspectScore(b: BusinessResult): number {
  let score = 0;
  if (b.phone) score += 1;
  if (b.website) score += 1;
  if (b.instagram) score += 1;
  if (!b.crmMatch) score += 1;
  if ((b.rating ?? 0) >= 4 && (b.reviewCount ?? 0) >= 10) score += 1;
  return score;
}

export function sortBusinesses(results: BusinessResult[], sort: SortValue): BusinessResult[] {
  const copy = [...results];
  switch (sort) {
    case "DISTANCE":
      return copy.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
    case "RATING":
      return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "REVIEWS":
      return copy.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "NAME":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "BEST_PROSPECT":
    default:
      return copy.sort((a, b) => bestProspectScore(b) - bestProspectScore(a));
  }
}
