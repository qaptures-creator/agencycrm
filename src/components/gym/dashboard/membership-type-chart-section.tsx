"use client";

import * as React from "react";
import { Download, Loader2, PieChart } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { MembershipTypeBarChart } from "@/components/charts/membership-type-bar-chart";
import { CHART_RANGE_PRESETS, type ChartRangePreset, type MembershipTypeReport } from "@/lib/gym/membership-type-report-shared";
import { cn, toDateInputValue } from "@/lib/utils";

/** Self-contained — manages its own date range client-side (not synced to
 * the Dashboard page's URL) and fetches its own data, rather than making
 * the whole Dashboard Server Component re-run every other card's queries
 * every time someone changes this chart's range. Server-rendered with the
 * default "This Year" view for fast first paint; every other range change
 * is a plain client fetch against /api/gym/membership-type-report. */
export function MembershipTypeChartSection({ initialReport }: { initialReport: MembershipTypeReport }) {
  const [preset, setPreset] = React.useState<ChartRangePreset>("this_year");
  const [customFrom, setCustomFrom] = React.useState(() => toDateInputValue(new Date(initialReport.from)));
  const [customTo, setCustomTo] = React.useState(() => toDateInputValue(new Date(initialReport.to)));
  const [report, setReport] = React.useState<MembershipTypeReport>(initialReport);
  const [loading, setLoading] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const fetchReport = React.useCallback(async (p: ChartRangePreset, from: string, to: string) => {
    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ range: p });
      if (p === "custom") {
        params.set("from", from);
        params.set("to", to);
      }
      const res = await fetch(`/api/gym/membership-type-report?${params.toString()}`);
      if (!res.ok) return;
      const data: MembershipTypeReport = await res.json();
      if (thisRequestId === requestIdRef.current) setReport(data);
    } finally {
      if (thisRequestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  function handlePreset(p: ChartRangePreset) {
    setPreset(p);
    if (p !== "custom") fetchReport(p, customFrom, customTo);
  }

  function handleCustomApply() {
    if (!customFrom || !customTo) return;
    setPreset("custom");
    fetchReport("custom", customFrom, customTo);
  }

  const exportParams = new URLSearchParams({ range: preset, format: "csv" });
  if (preset === "custom") {
    exportParams.set("from", customFrom);
    exportParams.set("to", customTo);
  }
  const exportUrl = `/api/gym/membership-type-report?${exportParams.toString()}`;

  const hasAnyData = report.buckets.some((b) => (b.total ?? 0) > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold">Membership Types Over Time</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            New memberships by type, based on each membership&apos;s start date — not a current-vs-historical snapshot.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <a href={exportUrl} download>
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {CHART_RANGE_PRESETS.map((p) => (
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

        <div className={cn("transition-opacity", loading && "opacity-60")}>
          {hasAnyData ? (
            <MembershipTypeBarChart buckets={report.buckets} types={report.types} />
          ) : (
            <EmptyState
              icon={PieChart}
              title="No memberships started in this range"
              description="Try a wider date range, or check back once more members join."
              className="border-none bg-transparent py-10"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
