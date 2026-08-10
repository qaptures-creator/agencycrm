"use client";

import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";

function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}

export function RevenueByPlanChart({ data }: { data: { name: string; monthlyRevenue: number }[] }) {
  return <HorizontalBarChart data={data} dataKey="monthlyRevenue" nameKey="name" valueFormatter={moneyGBP} />;
}
