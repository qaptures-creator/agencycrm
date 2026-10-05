import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { startOfDay, endOfDay, subDays, addDays, differenceInCalendarDays, format } from "date-fns";
import { ENTRY_STATS_RANGE_PRESETS, type EntryStatsRangePreset, type DailyEntryBucket, type EntryStatsReport } from "./entry-stats-shared";

export { ENTRY_STATS_RANGE_PRESETS };
export type { EntryStatsRangePreset, DailyEntryBucket, EntryStatsReport };

/**
 * Daily gym-entry statistics — "Monday: 60 members in, Tuesday: ..." — built
 * from GymLiveEntryEvent, the real gate-swipe log (not GymMember.lastVisitAt,
 * which is never written anywhere in this codebase — see the Returning Day
 * Passes investigation earlier this session for the full finding).
 *
 * Scope: member-matched entries only (memberId IS NOT NULL), per explicit
 * choice — unmatched card swipes are excluded from these counts, matching
 * "100 gym entries from members". The existing Live Feed page still shows
 * every raw event, matched or not, for reference.
 *
 * Always daily granularity, even across a ~2-month range — the whole point
 * of this report is day-by-day/weekday visibility, unlike the Membership
 * Types chart which switches to monthly for longer ranges.
 */

const MAX_CUSTOM_RANGE_DAYS = 180; // keeps the chart readable; an internal staff tool, not a hard product limit

export function resolveEntryStatsRange(
  preset: string | undefined,
  customFrom?: string,
  customTo?: string
): { from: Date; to: Date; label: string; preset: EntryStatsRangePreset } {
  const now = new Date();
  let from: Date;
  let to: Date;
  let label: string;
  let resolvedPreset: EntryStatsRangePreset = "last_60_days";

  switch (preset) {
    case "last_7_days":
      from = startOfDay(subDays(now, 6));
      to = endOfDay(now);
      label = "Last 7 Days";
      resolvedPreset = "last_7_days";
      break;
    case "last_30_days":
      from = startOfDay(subDays(now, 29));
      to = endOfDay(now);
      label = "Last 30 Days";
      resolvedPreset = "last_30_days";
      break;
    case "custom":
      if (customFrom && customTo) {
        from = startOfDay(new Date(customFrom));
        to = endOfDay(new Date(customTo));
        label = "Custom Range";
        resolvedPreset = "custom";
        if (differenceInCalendarDays(to, from) + 1 > MAX_CUSTOM_RANGE_DAYS) {
          from = startOfDay(subDays(to, MAX_CUSTOM_RANGE_DAYS - 1));
        }
        break;
      }
    case "last_60_days":
    default:
      from = startOfDay(subDays(now, 59));
      to = endOfDay(now);
      label = "Last 60 Days";
      resolvedPreset = "last_60_days";
      break;
  }

  return { from, to, label, preset: resolvedPreset };
}

function bucketKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export async function getDailyMemberEntryStats(range: { from: Date; to: Date }): Promise<EntryStatsReport> {
  const rows = await prisma.$queryRaw<Array<{ bucket: Date; unique_members: number; total_entries: number }>>(Prisma.sql`
    SELECT
      date_trunc('day', "entryTime") AS bucket,
      COUNT(DISTINCT "memberId")::int AS unique_members,
      COUNT(*)::int AS total_entries
    FROM "GymLiveEntryEvent"
    WHERE "entryTime" >= ${range.from} AND "entryTime" <= ${range.to} AND "memberId" IS NOT NULL
    GROUP BY 1
  `);

  const byDay = new Map<string, { uniqueMembers: number; totalEntries: number }>();
  for (const r of rows) {
    byDay.set(bucketKey(r.bucket), { uniqueMembers: r.unique_members, totalEntries: r.total_entries });
  }

  const now = new Date();
  const buckets: DailyEntryBucket[] = [];
  let cursor = startOfDay(range.from);
  const end = startOfDay(range.to);

  while (cursor <= end) {
    const key = bucketKey(cursor);
    const isFuture = cursor > now;
    const counts = byDay.get(key);
    buckets.push({
      date: key,
      label: format(cursor, "d MMM"),
      fullLabel: format(cursor, "EEEE, d MMM"),
      uniqueMembers: isFuture ? null : (counts?.uniqueMembers ?? 0),
      totalEntries: isFuture ? null : (counts?.totalEntries ?? 0),
      isFuture,
    });
    cursor = addDays(cursor, 1);
  }

  return { buckets, from: range.from.toISOString(), to: range.to.toISOString() };
}
