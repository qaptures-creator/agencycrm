import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, subDays, subMonths, addDays, addMonths, differenceInCalendarDays, format } from "date-fns";
import type { ChartRangePreset, MembershipTypeBucket, MembershipTypeReport } from "./membership-type-report-shared";
import { toCsv } from "./csv";
import { ACTIVE_MEMBERSHIP_TYPES, DAY_PASS_TYPE } from "./membership-rules";

/**
 * "Membership Types Over Time" — the one function powering both the
 * Dashboard chart and its CSV export (never two separate calculations that
 * could drift — the CSV is built directly from the same report object the
 * chart renders).
 *
 * Grouped by GymMembership.startDate (real, dated — see the Phase 14 audit
 * note shared with the user: this is a membership-record snapshot, not an
 * immutable historical ledger — a member who later renews will have their
 * startDate/type shift forward, so a past bucket's counts can change in a
 * future sync for that small subset of members. Precise, audit-trail-based
 * history is what GymMembershipEvent is for, going forward).
 */

// The plans the business actually tracks as distinct membership types —
// the same 3 genuine ongoing plans + Day Pass used by the Active
// Members/Day Passes KPIs elsewhere (membership-kpis.ts), reused here
// rather than re-derived so the chart's series never drift from what
// "counts" as a real membership type everywhere else in the CRM.
// Everything else (legacy/manual/test plans like "Cash Membership Temp",
// "1 Month Paid In Full", £0 placeholder plans, etc.) is real data but not
// a type the business reports on separately — it folds into "Other"
// rather than ranking by volume, which could otherwise let a higher-
// volume junk plan crowd a real plan out of its own series.
const CANONICAL_CHART_TYPES: readonly string[] = [...ACTIVE_MEMBERSHIP_TYPES, DAY_PASS_TYPE];
const DAILY_GRANULARITY_THRESHOLD_DAYS = 45;

export function resolveChartRange(preset: string | undefined, customFrom?: string, customTo?: string): { from: Date; to: Date; granularity: "day" | "month"; label: string; preset: ChartRangePreset } {
  const now = new Date();
  let from: Date;
  let to: Date;
  let label: string;
  let resolvedPreset: ChartRangePreset = "this_year";

  switch (preset) {
    case "this_month":
      from = startOfMonth(now);
      to = endOfMonth(now);
      label = "This Month";
      resolvedPreset = "this_month";
      break;
    case "last_30_days":
      from = startOfDay(subDays(now, 29));
      to = endOfDay(now);
      label = "Last 30 Days";
      resolvedPreset = "last_30_days";
      break;
    case "last_3_months":
      from = startOfMonth(subMonths(now, 2));
      to = endOfMonth(now);
      label = "Last 3 Months";
      resolvedPreset = "last_3_months";
      break;
    case "last_6_months":
      from = startOfMonth(subMonths(now, 5));
      to = endOfMonth(now);
      label = "Last 6 Months";
      resolvedPreset = "last_6_months";
      break;
    case "custom":
      if (customFrom && customTo) {
        from = startOfDay(new Date(customFrom));
        to = endOfDay(new Date(customTo));
        label = "Custom Range";
        resolvedPreset = "custom";
        break;
      }
    case "this_year":
    default:
      from = startOfYear(now);
      to = endOfYear(now);
      label = "This Year";
      resolvedPreset = "this_year";
      break;
  }

  const spanDays = differenceInCalendarDays(to, from) + 1;
  const granularity: "day" | "month" = spanDays <= DAILY_GRANULARITY_THRESHOLD_DAYS ? "day" : "month";

  return { from, to, granularity, label, preset: resolvedPreset };
}

function bucketKey(d: Date, granularity: "day" | "month"): string {
  return granularity === "day" ? format(d, "yyyy-MM-dd") : format(d, "yyyy-MM");
}

function bucketLabel(d: Date, granularity: "day" | "month"): string {
  return granularity === "day" ? format(d, "d MMM") : format(d, "MMM yyyy");
}

export async function getMembershipTypesOverTime(range: { from: Date; to: Date; granularity: "day" | "month" }): Promise<MembershipTypeReport> {
  const truncUnit = Prisma.raw(range.granularity === "day" ? "'day'" : "'month'");

  const rows = await prisma.$queryRaw<Array<{ bucket: Date; type: string; cnt: bigint }>>(Prisma.sql`
    SELECT date_trunc(${truncUnit}, gm."startDate") AS bucket, plan.name AS type, COUNT(*)::bigint AS cnt
    FROM "GymMembership" gm
    JOIN "GymMembershipPlan" plan ON plan.id = gm."planId"
    WHERE gm."startDate" >= ${range.from} AND gm."startDate" <= ${range.to}
    GROUP BY 1, 2
  `);

  // The 4 canonical types always get their own series, in a stable order,
  // whether or not they have volume in this particular range — so the
  // legend/colors stay consistent as the user switches date ranges.
  // Any non-canonical plan name present in the data folds into "Other".
  const hasOther = rows.some((r) => !CANONICAL_CHART_TYPES.includes(r.type));
  const types = hasOther ? [...CANONICAL_CHART_TYPES, "Other"] : [...CANONICAL_CHART_TYPES];

  const countsByBucketKey = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = bucketKey(r.bucket, range.granularity);
    const bucketCounts = countsByBucketKey.get(key) ?? {};
    const seriesName = CANONICAL_CHART_TYPES.includes(r.type) ? r.type : "Other";
    bucketCounts[seriesName] = (bucketCounts[seriesName] ?? 0) + Number(r.cnt);
    countsByBucketKey.set(key, bucketCounts);
  }

  // Build every bucket in [from, to] inclusive — including zero/empty ones,
  // so the timeline doesn't jump around — and mark anything starting after
  // today as future (null, never 0 — a month that hasn't happened isn't an
  // "observed zero").
  const now = new Date();
  const buckets: MembershipTypeBucket[] = [];
  let cursor = range.granularity === "day" ? startOfDay(range.from) : startOfMonth(range.from);
  const end = range.granularity === "day" ? startOfDay(range.to) : startOfMonth(range.to);

  while (cursor <= end) {
    const key = bucketKey(cursor, range.granularity);
    const isFuture = cursor > now;
    const counts = countsByBucketKey.get(key) ?? {};
    const byType: Record<string, number | null> = {};
    let total: number | null = isFuture ? null : 0;
    for (const t of types) {
      const v = isFuture ? null : (counts[t] ?? 0);
      byType[t] = v;
      if (v !== null) total = (total ?? 0) + v;
    }
    buckets.push({ date: key, label: bucketLabel(cursor, range.granularity), byType, total, isFuture });
    cursor = range.granularity === "day" ? addDays(cursor, 1) : addMonths(cursor, 1);
  }

  return { buckets, types, granularity: range.granularity, from: range.from.toISOString(), to: range.to.toISOString() };
}

/** Builds the CSV directly from the already-computed report — never a
 * separate query, so the export can never show different numbers than the
 * chart. Future buckets render as empty cells, not "0". */
export function membershipTypesOverTimeToCsv(report: MembershipTypeReport): string {
  const headers = ["Date", ...report.types, "Total"];
  const rows = report.buckets.map((b) => [b.label, ...report.types.map((t) => b.byType[t]), b.total]);
  return toCsv(headers, rows);
}
