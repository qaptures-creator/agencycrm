/**
 * Types/constants shared between the server-only query (returning-day-pass.ts)
 * and the client table/filter UI. No server-only guard, no Prisma — same
 * split used by member-filters-shared.ts and for the same reason: importing
 * anything from a server-only module into a "use client" component drags
 * Prisma into the client bundle and fails the production build.
 */

export const RDP_CONVERSION_FILTERS = ["All", "Converted", "Not Converted"] as const;
export type RdpConversionFilter = (typeof RDP_CONVERSION_FILTERS)[number];

export const RDP_COUNT_FILTERS = ["All", "2", "3", "4", "5"] as const;
export type RdpCountFilter = (typeof RDP_COUNT_FILTERS)[number];

export const RDP_SORT_KEYS = ["dayPassCount", "name", "firstDayPass", "lastActivity", "membershipStartDate"] as const;
export type RdpSortKey = (typeof RDP_SORT_KEYS)[number];

export const RDP_PAGE_SIZE = 50;

export type RdpFilters = {
  conversion: RdpConversionFilter;
  minCount: RdpCountFilter;
  status: string | null;
  q: string;
  sort: RdpSortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type RdpRow = {
  /** Not a GymMember id — this row can represent several GymMember records
   * that are the same real person (see returning-day-pass.ts for why).
   * Stable enough for a React key and for filter/sort identity, not a
   * foreign key to anything. */
  identityKey: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  dayPassCount: number;
  converted: boolean;
  otherPlanName: string | null;
  otherStatus: string | null;
  otherStartDate: string | null;
  firstDayPass: string;
  lastActivity: string | null;
};

export type RdpSummary = {
  returningCustomers: number;
  converted: number;
  notConverted: number;
  conversionRatePct: number;
  totalDayPassPurchases: number;
};
