"use client";

import * as React from "react";
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime, cn } from "@/lib/utils";
import { getLiveEntrySnapshotAction, type LiveEntrySnapshot } from "@/actions/gym/live-entry";

const POLL_INTERVAL_MS = 8_000;

export function LiveEntryWidget({ initialTodayStats }: { initialTodayStats: LiveEntrySnapshot["todayStats"] }) {
  const [todayStats, setTodayStats] = React.useState(initialTodayStats);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const snapshot = await getLiveEntrySnapshotAction(5);
        if (!cancelled) setTodayStats(snapshot.todayStats);
      } catch {
        // Best-effort polling — a transient failure just waits for the next tick.
      }
    };
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <DoorOpen className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Live Entry · Who&apos;s Come In Today</CardTitle>
        </div>
        <Link href="/gym/live-entry" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Unique Members</p>
            <p className="mt-1 text-xl font-semibold">{todayStats.uniqueMembersToday}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Entry Events</p>
            <p className="mt-1 text-xl font-semibold">{todayStats.totalEventsToday}</p>
          </div>
        </div>

        {todayStats.latest.length === 0 ? (
          <EmptyState icon={DoorOpen} title="No entries yet today" className="border-none bg-transparent py-6" />
        ) : (
          <div className="divide-y divide-border/60">
            {todayStats.latest.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-medium", !e.memberName && "italic text-muted-foreground")}>
                    {e.memberName ?? "Unknown Member"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.memberNumber} · {e.zone ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.entryTime)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
