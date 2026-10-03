/**
 * Types/constants shared between the Members page server component
 * (member-filters.ts, which also has the real Prisma query logic and is
 * import "server-only" guarded) and the client-side filter UI
 * (member-list.tsx). Deliberately has NO server-only guard and NO Prisma
 * import — anything a "use client" component needs at runtime (not just as
 * a type) has to live somewhere the client bundle is allowed to include.
 */

export const MEMBER_STATUS_TABS = ["All", "Active", "Cancelled", "Frozen", "Expired", "Payment Due", "Failed Payment", "New This Month"] as const;
export type MemberStatusTab = (typeof MEMBER_STATUS_TABS)[number];

export const MEMBER_SORT_KEYS = ["name", "type", "joinDate", "nextPayment", "status", "payment", "lastVisit"] as const;
export type MemberSortKey = (typeof MEMBER_SORT_KEYS)[number];

export const MEMBER_PAGE_SIZE = 50;

export type MemberListFilters = {
  status: MemberStatusTab;
  type: string | null;
  q: string;
  sort: MemberSortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type MemberRow = {
  id: string;
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinDate: string;
  lastVisitAt: string | null;
  membership: { planName: string; status: string; paymentStatus: string; renewalDate: string | null } | null;
};
