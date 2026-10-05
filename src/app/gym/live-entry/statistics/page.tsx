import { requireTabAccess } from "@/lib/gym/auth";
import { resolveEntryStatsRange, getDailyMemberEntryStats } from "@/lib/gym/entry-stats";
import { EntrySectionNav } from "../entry-section-nav";
import { EntryStatsSection } from "./entry-stats-section";

export default async function EntryStatisticsPage() {
  await requireTabAccess("/gym/live-entry");

  const range = resolveEntryStatsRange("last_60_days");
  const report = await getDailyMemberEntryStats(range);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Entry</h1>
        <p className="text-sm text-muted-foreground">
          Gate-entry events from the Ashbourne access control system, newest first. Entry only — there is no reliable exit signal yet.
        </p>
      </div>

      <EntrySectionNav />

      <EntryStatsSection initialReport={{ ...report, rangeLabel: range.label, preset: range.preset }} />
    </div>
  );
}
