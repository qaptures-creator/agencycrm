"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { MembershipTypeBucket } from "@/lib/gym/membership-type-report-shared";

// Matches the 5 defined --chart-N tokens; "Other" (only appears when there
// are more than 5 real membership types) gets a neutral muted tone rather
// than a 6th hue.
const SERIES_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];
const OTHER_COLOR = "var(--color-muted-foreground)";

function colorFor(type: string, index: number): string {
  return type === "Other" ? OTHER_COLOR : SERIES_COLORS[index % SERIES_COLORS.length];
}

function CustomTooltipContent({ active, payload, label }: { active?: boolean; payload?: { color?: string; name?: string; value?: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  // Future buckets carry no series at all (null values filtered out by
  // recharts before reaching here) — show that explicitly rather than a
  // tooltip that looks like a real zero-value reading.
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-medium tabular-nums text-foreground">{entry.value}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-1 font-medium text-foreground">
        <span>Total</span>
        <span className="tabular-nums">{total}</span>
      </div>
    </div>
  );
}

export function MembershipTypeBarChart({ buckets, types }: { buckets: MembershipTypeBucket[]; types: string[] }) {
  // recharts needs flat objects; null stays null (not 0) so a future/
  // unobserved bucket renders as a genuine gap, not a zero-height bar.
  const data = buckets.map((b) => ({ label: b.label, ...b.byType }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={<CustomTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
        {types.map((t, i) => (
          <Bar key={t} dataKey={t} name={t} stackId="membership-types" fill={colorFor(t, i)} radius={i === types.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
