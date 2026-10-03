/**
 * Types/constants shared between the server-only reporting logic
 * (membership-type-report.ts) and the client chart/date-range UI. No
 * server-only guard, no Prisma — see member-filters-shared.ts for why this
 * split exists (importing anything from a server-only module, even just a
 * constant, from a "use client" component drags the whole module — Prisma
 * included — into the client bundle and fails the build).
 */

export const CHART_RANGE_PRESETS = [
  { value: "this_month", label: "This Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
] as const;
export type ChartRangePreset = (typeof CHART_RANGE_PRESETS)[number]["value"];

export type MembershipTypeBucket = {
  /** ISO date of the bucket start — the first of the month, or the day itself for daily granularity. */
  date: string;
  /** Display label — "Jan 2026" for monthly, "3 Oct" for daily. */
  label: string;
  /** count per membership type name, or null if this bucket is entirely in the future (never 0 for a future period — 0 would wrongly imply an observed result). */
  byType: Record<string, number | null>;
  total: number | null;
  isFuture: boolean;
};

export type MembershipTypeReport = {
  buckets: MembershipTypeBucket[];
  /** The series to plot/export, in a stable order (largest-first by total volume in range, capped — see membership-type-report.ts for the grouping-into-"Other" rule). */
  types: string[];
  granularity: "day" | "month";
  from: string;
  to: string;
};
