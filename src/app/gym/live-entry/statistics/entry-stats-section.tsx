"use client";

import * as React from "react";
import { Loader2, DoorOpen } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EntryStatsBarChart } from "@/components/charts/entry-stats-bar-chart";
import { ENTRY_STATS_RANGE_PRESETS, type EntryStatsRangePreset, type EntryStatsReport } from "@/lib/gym/entry-stats-shared";
import { cn, toDateInputValue } from "@/lib/utils";

/** Mirrors MembershipTypeChartSection's design (same session, same pattern):
 * server-renders the default range for fast first paint, then a plain
 * client fetch against /api/gym/entry-stats for every other range change —
 * no live polling here (unlike the Live Feed page), since day-by-day
 * history doesn't need to update every few seconds. */
export function EntryStatsSection({ initialReport }: { initialReport: EntryStatsReport & { rangeLabel: string; preset: EntryStatsRangePreset } }) {
  const [preset, setPreset] = React.useState<EntryStatsRangePreset>(initialReport.preset);
  const [customFrom, setCustomFrom] = React.useState(() => toDateInputValue(new Date(initialReport.from)));
  const [customTo, setCustomTo] = React.useState(() => toDateInputValue(new Date(initialReport.to)));
  const [report, setReport] = React.useState<EntryStatsReport>(initialReport);
  const [loading, setLoading] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const fetchReport = React.useCallback(async (p: EntryStatsRangePreset, from: string, to: string) => {
    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ range: p });
      if (p === "custom") {
        params.set("from", from);
        params.set("to", to);
      }
      const res = await fetch(`/api/gym/entry-stats?${params.toString()}`);
      if (!res.ok) return;
      const data: EntryStatsReport = await res.json();
      if (thisRequestId === requestIdRef.current) setReport(data);
    } finally {
      if (thisRequestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  function handlePreset(p: EntryStatsRangePreset) {
    setPreset(p);
    if (p !== "custom") fetchReport(p, customFrom, customTo);
  }

  function handleCustomApply() {
    if (!customFrom || !customTo) return;
    setPreset("custom");
    fetchReport("custom", customFrom, customTo);
  }

  const sumUniqueMembers = report.buckets.reduce((sum, b) => sum + (b.uniqueMembers ?? 0), 0);
  const totalEntries = report.buckets.reduce((sum, b) => sum + (b.totalEntries ?? 0), 0);
  const observedDays = report.buckets.filter((b) => !b.isFuture).length;
  const avgPerDay = observedDays > 0 ? sumUniqueMembers / observedDays : 0;
  const hasAnyData = sumUniqueMembers > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Daily Member Entries</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Distinct members who swiped in each day — gate events only, from the Ashbourne access control system. Unmatched card swipes aren&apos;t counted here.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {ENTRY_STATS_RANGE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  preset === p.value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={customFrom}
              max={toDateInputValue(new Date())}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            />
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={customTo}
              max={toDateInputValue(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            />
            <Button size="sm" onClick={handleCustomApply}>
              Apply
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Total Member Entries</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{totalEntries}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Avg Members In / Day</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{avgPerDay.toFixed(1)}</p>
          </div>
        </div>

        <div className={cn("transition-opacity", loading && "opacity-60")}>
          {hasAnyData ? (
            <EntryStatsBarChart buckets={report.buckets} />
          ) : (
            <EmptyState
              icon={DoorOpen}
              title="No member entries in this range"
              description="Try a wider date range, or check back once gate activity comes through."
              className="border-none bg-transparent py-10"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
