import { requireGymUser } from "@/lib/gym/auth";
import { getRecentLiveEntries, getTodayLiveEntryStats } from "@/lib/gym/live-entry-data";
import { LiveEntryTable } from "./live-entry-table";

export default async function LiveEntryPage() {
  await requireGymUser();

  const [entries, todayStats] = await Promise.all([getRecentLiveEntries(100), getTodayLiveEntryStats()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Live Entry</h1>
        <p className="text-sm text-muted-foreground">
          Gate-entry events from the Ashbourne access control system, newest first. Entry only — there is no reliable exit signal yet.
        </p>
      </div>

      <LiveEntryTable initialEntries={entries} initialTodayStats={todayStats} />
    </div>
  );
}
