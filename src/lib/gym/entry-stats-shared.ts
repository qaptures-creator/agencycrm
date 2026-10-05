/**
 * Types/constants shared between the server-only query (entry-stats.ts)
 * and the client chart/date-range UI — same split as member-filters-shared.ts
 * and membership-type-report-shared.ts, for the same reason (server-only
 * can't be imported into a "use client" component).
 */

export const ENTRY_STATS_RANGE_PRESETS = [
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_60_days", label: "Last 60 Days" },
  { value: "custom", label: "Custom Range" },
] as const;
export type EntryStatsRangePreset = (typeof ENTRY_STATS_RANGE_PRESETS)[number]["value"];

export type DailyEntryBucket = {
  /** ISO date of the day. */
  date: string;
  /** Compact axis label, e.g. "5 Oct". */
  label: string;
  /** Full label for the tooltip, e.g. "Monday, 5 Oct". */
  fullLabel: string;
  /** Distinct members who entered that day — null, never 0, for a day that hasn't happened yet. */
  uniqueMembers: number | null;
  /** Total member-matched entry events that day (a member can swipe in more than once a day). */
  totalEntries: number | null;
  isFuture: boolean;
};

export type EntryStatsReport = {
  buckets: DailyEntryBucket[];
  from: string;
  to: string;
};
