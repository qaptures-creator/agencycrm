"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export function BarSeriesChart<T extends Record<string, unknown>>({
  data,
  xKey,
  bars,
  height = 240,
}: {
  data: T[];
  xKey: string;
  bars: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-secondary)" }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
