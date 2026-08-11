import Link from "next/link";
import {
  Building2,
  TrendingUp,
  Wallet,
  Users2,
  KanbanSquare,
  Trophy,
  Percent,
  Camera,
  PackageCheck,
  AlertTriangle,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/stat-card";
import { ChartCard } from "@/components/charts/chart-card";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarSeriesChart } from "@/components/charts/bar-series-chart";
import { ActivityFeed } from "@/components/activity-feed";
import { UpcomingList } from "@/components/upcoming-list";
import {
  calcMRR,
  calcRevenueThisMonth,
  calcOutstanding,
  calcPipelineValue,
  calcWonValue,
  calcConversionRate,
  isInvoiceOverdue,
} from "@/lib/finance";
import { monthlyRevenueSeries, leadsBySource, dealsWonLostSeries } from "@/lib/chart-data";
import { formatCurrency, formatDate, isOverdue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [clients, invoices, leads, projects, deliverables, activities] = await Promise.all([
    prisma.client.findMany({ include: { retainer: true } }),
    prisma.invoice.findMany({ include: { client: true } }),
    prisma.lead.findMany({ include: { stage: true } }),
    prisma.project.findMany({
      where: { shootDate: { gte: new Date() } },
      orderBy: { shootDate: "asc" },
      include: { client: true },
      take: 8,
    }),
    prisma.deliverable.findMany({ include: { status: true, client: true } }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { createdBy: true, lead: true, client: true },
    }),
  ]);

  const activeClients = clients.filter((c) => c.status === "ACTIVE").length;
  const mrr = calcMRR(clients);
  const revenueThisMonth = calcRevenueThisMonth(invoices);
  const pipelineLeads = leads.filter((l) => !l.stage.isWon && !l.stage.isLost);
  const pipelineValue = calcPipelineValue(leads);
  const dealsWon = leads.filter((l) => l.stage.isWon).length;
  const conversionRate = calcConversionRate(leads);
  const outstanding = calcOutstanding(invoices);
  const overdueInvoiceCount = invoices.filter(isInvoiceOverdue).length;

  const deliverablesDue = deliverables.filter((d) => !d.status.isTerminal && d.deadline).length;
  const overdueDeliverables = deliverables.filter((d) => !d.status.isTerminal && d.deadline && isOverdue(d.deadline));

  const revenueSeries = monthlyRevenueSeries(invoices, 6);
  const sourceData = leadsBySource(leads.map((l) => ({ ...l })));
  const dealsSeries = dealsWonLostSeries(leads, 6);

  const hasRevenue = revenueSeries.some((d) => d.revenue > 0);
  const hasSources = sourceData.length > 0;
  const hasDeals = dealsSeries.some((d) => d.won > 0 || d.lost > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your agency, at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Active Clients" value={activeClients} icon={Building2} />
        <StatCard label="MRR" value={formatCurrency(mrr)} icon={TrendingUp} tone="success" />
        <StatCard label="Revenue This Month" value={formatCurrency(revenueThisMonth)} icon={Wallet} />
        <StatCard label="Leads in Pipeline" value={pipelineLeads.length} icon={Users2} />
        <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} icon={KanbanSquare} />
        <StatCard label="Deals Won" value={dealsWon} icon={Trophy} tone="success" hint={formatCurrency(calcWonValue(leads))} />
        <StatCard label="Conversion Rate" value={`${conversionRate}%`} icon={Percent} />
        <StatCard label="Upcoming Shoots" value={projects.length} icon={Camera} />
        <StatCard label="Deliverables Due" value={deliverablesDue} icon={PackageCheck} />
        <StatCard
          label="Overdue Deliverables"
          value={overdueDeliverables.length}
          icon={AlertTriangle}
          tone={overdueDeliverables.length > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Outstanding Invoices"
          value={formatCurrency(outstanding)}
          icon={Clock}
          tone={overdueInvoiceCount > 0 ? "warning" : "default"}
          hint={overdueInvoiceCount > 0 ? `${overdueInvoiceCount} overdue` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Revenue Over Time"
          subtitle="Paid invoices, last 6 months"
          isEmpty={!hasRevenue}
          emptyIcon={BarChart3}
          emptyMessage="Revenue will chart here once invoices are marked paid."
          className="lg:col-span-2"
        >
          <RevenueAreaChart data={revenueSeries} />
        </ChartCard>

        <ChartCard
          title="Leads by Source"
          isEmpty={!hasSources}
          emptyIcon={PieChartIcon}
          emptyMessage="Add leads with a source to see the breakdown."
        >
          <DonutChart data={sourceData} dataKey="count" nameKey="source" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Deals Won vs Lost"
          subtitle="Last 6 months"
          isEmpty={!hasDeals}
          emptyIcon={BarChart3}
          emptyMessage="Move leads to Won or Lost to see trends here."
        >
          <BarSeriesChart
            data={dealsSeries}
            xKey="month"
            bars={[
              { key: "won", name: "Won", color: "var(--color-success)" },
              { key: "lost", name: "Lost", color: "var(--color-destructive)" },
            ]}
            height={220}
          />
        </ChartCard>

        <UpcomingList
          title="Upcoming Shoots"
          items={projects.map((p) => ({
            id: p.id,
            title: p.name,
            subtitle: p.client.companyName,
            date: p.shootDate ? formatDate(p.shootDate) : "",
            href: `/projects?project=${p.id}`,
          }))}
          emptyMessage="No shoots scheduled yet."
          viewAllHref="/calendar"
        />

        <UpcomingList
          title="Overdue Deliverables"
          items={overdueDeliverables.slice(0, 8).map((d) => ({
            id: d.id,
            title: d.customTypeName || d.contentType,
            subtitle: d.client.companyName,
            date: d.deadline ? formatDate(d.deadline) : "",
            href: `/deliverables?deliverable=${d.id}`,
            danger: true,
          }))}
          emptyMessage="Nothing overdue. Nice work."
          viewAllHref="/deliverables"
        />
      </div>

      <ActivityFeed activities={activities} />

      {clients.length === 0 && leads.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Link href="/crm" className="font-medium text-primary hover:underline">
            Add your first lead
          </Link>{" "}
          to start building your pipeline — your dashboard fills in as you go.
        </div>
      )}
    </div>
  );
}
