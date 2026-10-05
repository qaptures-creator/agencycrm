"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyEntryBucket } from "@/lib/gym/entry-stats-shared";

function CustomTooltipContent({ active, payload }: { active?: boolean; payload?: { payload?: DailyEntryBucket }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{bucket.fullLabel}</p>
      {bucket.isFuture ? (
        <p className="text-muted-foreground">Hasn&apos;t happened yet</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 text-muted-foreground">
            <span>Members in</span>
            <span className="font-medium tabular-nums text-foreground">{bucket.uniqueMembers}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-muted-foreground">
            <span>Total entries</span>
            <span className="font-medium tabular-nums text-foreground">{bucket.totalEntries}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function EntryStatsBarChart({ buckets }: { buckets: DailyEntryBucket[] }) {
  const data = buckets.map((b) => ({ ...b, uniqueMembers: b.uniqueMembers ?? undefined }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
        <Tooltip content={<CustomTooltipContent />} cursor={{ fill: "var(--color-secondary)" }} />
        <Bar dataKey="uniqueMembers" name="Members In" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
