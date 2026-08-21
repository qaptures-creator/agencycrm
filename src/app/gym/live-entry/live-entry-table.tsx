"use client";

import * as React from "react";
import { DoorOpen, Users } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { StatCard } from "@/components/stat-card";
import { MEMBERSHIP_STATUSES } from "@/lib/gym/constants";
import { formatDateTime } from "@/lib/utils";
import { getLiveEntrySnapshotAction, type LiveEntrySnapshot } from "@/actions/gym/live-entry";

const POLL_INTERVAL_MS = 6_000;

export function LiveEntryTable({
  initialEntries,
  initialTodayStats,
}: {
  initialEntries: LiveEntrySnapshot["entries"];
  initialTodayStats: LiveEntrySnapshot["todayStats"];
}) {
  const [entries, setEntries] = React.useState(initialEntries);
  const [todayStats, setTodayStats] = React.useState(initialTodayStats);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const snapshot = await getLiveEntrySnapshotAction(100);
        if (!cancelled) {
          setEntries(snapshot.entries);
          setTodayStats(snapshot.todayStats);
        }
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard label="Unique Members Today" value={todayStats.uniqueMembersToday} icon={Users} />
        <StatCard label="Entry Events Today" value={todayStats.totalEventsToday} icon={DoorOpen} />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No entries yet"
          description="Gate-entry events from the Ashbourne access control bridge will appear here as they happen."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry Time</TableHead>
                <TableHead>Member Name</TableHead>
                <TableHead>Member Number</TableHead>
                <TableHead>Membership Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.entryTime)}</TableCell>
                  <TableCell className={e.memberName ? "font-medium" : "text-muted-foreground italic"}>
                    {e.memberName ?? "Unknown Member"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.memberNumber ?? e.cardNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{e.membershipType ?? "—"}</TableCell>
                  <TableCell>
                    {e.membershipStatus ? <GymStatusBadge list={MEMBERSHIP_STATUSES} value={e.membershipStatus} /> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.zone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
