"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export function HorizontalBarChart({
  data,
  dataKey,
  nameKey,
  color = "var(--color-chart-1)",
  colors,
  height,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  color?: string;
  colors?: string[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(120, data.length * 42)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey={nameKey}
          tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          content={<ChartTooltip valueFormatter={valueFormatter} />}
          cursor={{ fill: "var(--color-secondary)" }}
        />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors ? colors[i % colors.length] : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
