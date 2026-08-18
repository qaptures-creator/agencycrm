"use client";

import { TrendingUp, TrendingDown, Minus, Users, Wallet, Target, UsersRound, Wrench, LineChart } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { CsvExportButton } from "@/components/gym/csv-export-button";
import { ChartCard } from "@/components/charts/chart-card";
import { BarSeriesChart } from "@/components/charts/bar-series-chart";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { LEAD_SOURCES, MAINTENANCE_STATUSES, labelFor } from "@/lib/gym/constants";
import type {
  getMembershipReport,
  getRevenueReport,
  getLeadsReport,
  getStaffReport,
  getOperationsReport,
  getSignupsTrend,
  getRevenueTrend,
  getPaymentTypeMix,
} from "@/lib/gym/reports-data";
import { cn } from "@/lib/utils";

function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">No prior data</span>;
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        pct > 0 && "text-success",
        pct < 0 && "text-destructive",
        pct === 0 && "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(pct).toFixed(1)}% vs previous period
    </span>
  );
}

function SectionHeader({ title, subtitle, exportRows, exportFilename }: { title: string; subtitle: string; exportRows: Record<string, string | number>[]; exportFilename: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <CsvExportButton filename={exportFilename} rows={exportRows} />
    </div>
  );
}

type MembershipData = Awaited<ReturnType<typeof getMembershipReport>>;
type SignupsTrendData = Awaited<ReturnType<typeof getSignupsTrend>>;

export function MembershipSection({
  data,
  rangeLabel,
  signupsTrend,
}: {
  data: MembershipData;
  rangeLabel: string;
  signupsTrend: SignupsTrendData;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Membership"
        subtitle={rangeLabel}
        exportFilename="membership-report"
        exportRows={[
          {
            activeMembers: data.activeMembers,
            newMembers: data.newMembers,
            cancellations: data.cancellations,
            frozen: data.frozen,
          },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Members" value={data.activeMembers} icon={Users} />
        <StatCard label="New Members" value={data.newMembers} icon={Users} tone="success" hint={undefined} />
        <StatCard label="Cancellations" value={data.cancellations} icon={Users} tone={data.cancellations > 0 ? "warning" : "default"} />
        <StatCard label="Frozen Memberships" value={data.frozen} icon={Users} />
      </div>
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-secondary/20 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">New members growth: <Trend pct={data.newMembersGrowthPct} /></span>
        <span className="text-xs text-muted-foreground">Cancellations change: <Trend pct={data.cancellationsGrowthPct} /></span>
      </div>
      <ChartCard
        title="Signups — Last 12 Months"
        isEmpty={signupsTrend.every((m) => m.signups === 0)}
        emptyIcon={LineChart}
        emptyMessage="New member signups will build up a trend here over time."
      >
        <BarSeriesChart data={signupsTrend} xKey="month" bars={[{ key: "signups", name: "New Members", color: "var(--color-chart-2)" }]} />
      </ChartCard>
    </div>
  );
}

type RevenueData = Awaited<ReturnType<typeof getRevenueReport>>;
type RevenueTrendData = Awaited<ReturnType<typeof getRevenueTrend>>;
type PaymentTypeMixData = Awaited<ReturnType<typeof getPaymentTypeMix>>;

export function RevenueSection({
  data,
  rangeLabel,
  revenueTrend,
  paymentTypeMix,
}: {
  data: RevenueData;
  rangeLabel: string;
  revenueTrend: RevenueTrendData | null;
  paymentTypeMix: PaymentTypeMixData | null;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Revenue"
        subtitle={rangeLabel}
        exportFilename="revenue-report"
        exportRows={
          data.hasData
            ? data.revenueByPlan.map((p) => ({ plan: p.name, revenue: p.amount }))
            : []
        }
      />
      {!data.hasData ? (
        <EmptyState icon={Wallet} title="No payment data recorded yet" description="Connect Ashbourne in Settings → Integrations, or record payments manually, to see revenue here." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Revenue" value={moneyGBP(data.revenue)} icon={Wallet} tone="success" />
            <StatCard label="Failed Payments" value={data.failedCount} icon={Wallet} tone={data.failedCount > 0 ? "destructive" : "default"} hint={data.failedCount > 0 ? moneyGBP(data.failedAmount) : undefined} />
            <StatCard label="Previous Period" value={moneyGBP(data.revenuePrev)} icon={Wallet} />
          </div>
          <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-secondary/20 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">Growth: <Trend pct={data.growthPct} /></span>
          </div>
          {revenueTrend && (
            <ChartCard
              title="Revenue — Last 12 Months"
              isEmpty={revenueTrend.every((m) => m.revenue === 0)}
              emptyIcon={LineChart}
              emptyMessage="Recorded payments will build up a revenue trend here over time."
            >
              <RevenueAreaChart data={revenueTrend} />
            </ChartCard>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Revenue by Membership Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.revenueByPlan.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="font-medium">{moneyGBP(p.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            {paymentTypeMix && (
              <ChartCard
                title="Revenue by Payment Type"
                subtitle={rangeLabel}
                isEmpty={paymentTypeMix.length === 0}
                emptyIcon={Wallet}
                emptyMessage="No payments recorded in this period."
              >
                <DonutChart data={paymentTypeMix} dataKey="amount" nameKey="name" valueFormatter={moneyGBP} />
              </ChartCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type LeadsData = Awaited<ReturnType<typeof getLeadsReport>>;

export function LeadsSection({ data, rangeLabel }: { data: LeadsData; rangeLabel: string }) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Leads"
        subtitle={rangeLabel}
        exportFilename="leads-report"
        exportRows={data.bySource.map((s) => ({ source: labelFor(LEAD_SOURCES, s.source), count: s.count }))}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Leads Generated" value={data.leadsGenerated} icon={Target} />
        <StatCard label="Converted (Joined)" value={data.leadsConverted} icon={Target} tone="success" />
        <StatCard label="Conversion Rate" value={`${data.conversionRate.toFixed(1)}%`} icon={Target} />
      </div>
      {data.bySource.length === 0 ? (
        <EmptyState icon={Target} title="No leads in this period" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.bySource.map((s) => (
                <tr key={s.source}>
                  <td className="px-4 py-2.5">{labelFor(LEAD_SOURCES, s.source)}</td>
                  <td className="px-4 py-2.5">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type StaffData = Awaited<ReturnType<typeof getStaffReport>>;

export function StaffSection({ data, rangeLabel }: { data: StaffData; rangeLabel: string }) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Staff"
        subtitle={rangeLabel}
        exportFilename="staff-report"
        exportRows={[
          {
            scheduledHours: data.scheduledHours,
            shifts: data.shiftsCount,
            attendanceRecorded: data.attendanceRecorded,
            attendanceComplete: data.attendanceComplete,
            attendanceRatePct: data.attendanceRate.toFixed(1),
            tasksTotal: data.tasksTotal,
            tasksCompleted: data.tasksCompleted,
            taskCompletionRatePct: data.taskCompletionRate.toFixed(1),
          },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Scheduled Hours" value={data.scheduledHours} icon={UsersRound} />
        <StatCard label="Shifts" value={data.shiftsCount} icon={UsersRound} />
        <StatCard label="Attendance Rate" value={`${data.attendanceRate.toFixed(0)}%`} icon={UsersRound} hint={`${data.attendanceComplete}/${data.attendanceRecorded} complete`} />
        <StatCard label="Task Completion" value={`${data.taskCompletionRate.toFixed(0)}%`} icon={UsersRound} hint={`${data.tasksCompleted}/${data.tasksTotal} tasks`} />
      </div>
    </div>
  );
}

type OperationsData = Awaited<ReturnType<typeof getOperationsReport>>;

export function OperationsSection({ data, rangeLabel }: { data: OperationsData; rangeLabel: string }) {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Operations"
        subtitle={rangeLabel}
        exportFilename="operations-report"
        exportRows={data.ticketsByStatus.map((t) => ({ status: labelFor(MAINTENANCE_STATUSES, t.status), count: t.count }))}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Open Maintenance Tickets" value={data.openTickets} icon={Wrench} tone={data.openTickets > 0 ? "warning" : "default"} />
        <StatCard label="Equipment Out of Service" value={data.equipmentOutOfService} icon={Wrench} tone={data.equipmentOutOfService > 0 ? "destructive" : "default"} />
        <StatCard label="Incidents This Period" value={data.incidentsThisPeriod} icon={Wrench} hint={data.incidentsTrendPct !== null ? `${data.incidentsTrendPct > 0 ? "+" : ""}${data.incidentsTrendPct.toFixed(0)}% vs previous` : undefined} />
      </div>
      {data.ticketsByStatus.length === 0 ? (
        <EmptyState icon={Wrench} title="No maintenance tickets recorded" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Maintenance Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.ticketsByStatus.map((t) => (
              <div key={t.status} className="flex items-center justify-between text-sm">
                <span>{labelFor(MAINTENANCE_STATUSES, t.status)}</span>
                <span className="font-medium">{t.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
