"use server";

import { requireGymUser } from "@/lib/gym/auth";
import { getRecentLiveEntries, getTodayLiveEntryStats, type LiveEntryRow, type LiveEntryTodayStats } from "@/lib/gym/live-entry-data";

export type LiveEntrySnapshot = {
  entries: LiveEntryRow[];
  todayStats: LiveEntryTodayStats;
};

/** Polled from the client (Live Entry page + dashboard widget) to pick up
 * new gate-entry events without a full page reload. Read-only — gated
 * behind the same session auth as every other gym page. */
export async function getLiveEntrySnapshotAction(limit = 100): Promise<LiveEntrySnapshot> {
  await requireGymUser();
  const [entries, todayStats] = await Promise.all([getRecentLiveEntries(limit), getTodayLiveEntryStats()]);
  return { entries, todayStats };
}
