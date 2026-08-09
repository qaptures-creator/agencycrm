import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users2, Trophy, Building2, PackageCheck, Filter } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ChartCard } from "@/components/charts/chart-card";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarSeriesChart } from "@/components/charts/bar-series-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import {
  monthlyRevenueSeries,
  leadsGeneratedSeries,
  leadsBySource,
  dealsWonLostSeries,
  clientRevenueSeries,
  contentDeliveredSeries,
  conversionFunnel,
} from "@/lib/chart-data";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [invoices, leads, clients, deliverables] = await Promise.all([
    prisma.invoice.findMany({ include: { client: true } }),
    prisma.lead.findMany({ include: { stage: true } }),
    prisma.client.findMany({ include: { retainer: true } }),
    prisma.deliverable.findMany({ include: { status: true } }),
  ]);

  const revenueSeries = monthlyRevenueSeries(invoices, 6);
  const leadsSeries = leadsGeneratedSeries(leads, 6);
  const sourceData = leadsBySource(leads);
  const dealsSeries = dealsWonLostSeries(leads, 6);
  const clientRevenue = clientRevenueSeries(invoices);
  const contentSeries = contentDeliveredSeries(deliverables, 6);
  const funnel = conversionFunnel(leads, clients.length);
  const mrrByClient = clients
    .filter((c) => c.status === "ACTIVE" && (c.retainer?.monthlyRetainer ?? c.monthlyRetainer))
    .map((c) => ({ name: c.companyName, mrr: c.retainer?.monthlyRetainer ?? c.monthlyRetainer ?? 0 }))
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 8);

  const hasRevenue = revenueSeries.some((d) => d.revenue > 0);
  const hasLeads = leadsSeries.some((d) => d.leads > 0);
  const hasSources = sourceData.length > 0;
  const hasDeals = dealsSeries.some((d) => d.won > 0 || d.lost > 0);
  const hasClientRevenue = clientRevenue.length > 0;
  const hasContent = contentSeries.some((d) => d.delivered > 0);
  const hasFunnel = funnel[0].value > 0;
  const hasMRR = mrrByClient.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Deeper trends across your pipeline, clients and content.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue Over Time" subtitle="Paid invoices, last 6 months" isEmpty={!hasRevenue} emptyIcon={BarChart3} emptyMessage="Revenue will chart here once invoices are marked paid.">
          <RevenueAreaChart data={revenueSeries} />
        </ChartCard>

        <ChartCard title="Leads Generated" subtitle="New leads per month" isEmpty={!hasLeads} emptyIcon={Users2} emptyMessage="Add leads to see monthly trends.">
          <BarSeriesChart data={leadsSeries} xKey="month" bars={[{ key: "leads", name: "Leads", color: "var(--color-chart-1)" }]} />
        </ChartCard>

        <ChartCard title="Leads by Source" isEmpty={!hasSources} emptyIcon={PieChartIcon} emptyMessage="Add a source to your leads to see the breakdown.">
          <DonutChart data={sourceData} dataKey="count" nameKey="source" />
        </ChartCard>

        <ChartCard title="Lead → Client Conversion" subtitle="Funnel across all time" isEmpty={!hasFunnel} emptyIcon={Filter} emptyMessage="Add leads to see your conversion funnel.">
          <HorizontalBarChart
            data={funnel}
            dataKey="value"
            nameKey="stage"
            colors={["var(--color-chart-3)", "var(--color-chart-2)", "var(--color-success)"]}
            height={160}
          />
        </ChartCard>

        <ChartCard title="Deals Won vs Lost" subtitle="Last 6 months" isEmpty={!hasDeals} emptyIcon={Trophy} emptyMessage="Move leads to Won or Lost to see trends here.">
          <BarSeriesChart
            data={dealsSeries}
            xKey="month"
            bars={[
              { key: "won", name: "Won", color: "var(--color-success)" },
              { key: "lost", name: "Lost", color: "var(--color-destructive)" },
            ]}
          />
        </ChartCard>

        <ChartCard title="Client Revenue" subtitle="Total paid, top clients" isEmpty={!hasClientRevenue} emptyIcon={Building2} emptyMessage="Mark invoices as paid to see revenue by client.">
          <HorizontalBarChart data={clientRevenue} dataKey="revenue" nameKey="name" valueFormatter={(v) => formatCurrency(v)} height={Math.max(160, clientRevenue.length * 36)} />
        </ChartCard>

        <ChartCard title="Content Delivered" subtitle="Completed deliverables per month" isEmpty={!hasContent} emptyIcon={PackageCheck} emptyMessage="Mark deliverables with a terminal status to track delivery volume.">
          <BarSeriesChart data={contentSeries} xKey="month" bars={[{ key: "delivered", name: "Delivered", color: "var(--color-chart-4)" }]} />
        </ChartCard>

        <ChartCard title="Monthly Recurring Revenue" subtitle="By active client" isEmpty={!hasMRR} emptyIcon={TrendingUp} emptyMessage="Set a monthly retainer on an active client to see MRR breakdown.">
          <HorizontalBarChart data={mrrByClient} dataKey="mrr" nameKey="name" color="var(--color-success)" valueFormatter={(v) => formatCurrency(v)} height={Math.max(160, mrrByClient.length * 36)} />
        </ChartCard>
      </div>
    </div>
  );
}
