"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function DonutChart({
  data,
  dataKey,
  nameKey,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={55} outerRadius={90} paddingAngle={2} strokeWidth={0}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{ fontSize: 11, lineHeight: "1.6rem" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
