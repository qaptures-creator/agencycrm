// Client-safe date-range types/constants shared between finance-data.ts
// (server-only) and the finance date filter client component.

export type DateRangeKey = "today" | "week" | "month" | "last_month" | "last_3_months" | "year" | "custom";

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
];
