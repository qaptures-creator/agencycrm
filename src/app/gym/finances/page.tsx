import { Wallet, CalendarDays, TrendingUp, AlertTriangle, XCircle, UserPlus, UserMinus, BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/gym/auth";
import { isAshbourneConnected } from "@/lib/gym/integrations/ashbourne-provider";
import {
  resolveDateRange,
  getFinanceKpis,
  getRevenueOverTime,
  getRevenueByPlan,
  getFailedPayments,
  hasAnyPaymentData,
  type DateRangeKey,
} from "@/lib/gym/finance-data";
import { StatCard } from "@/components/stat-card";
import { ChartCard } from "@/components/charts/chart-card";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { RevenueByPlanChart } from "./revenue-by-plan-chart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PAYMENT_TX_STATUSES } from "@/lib/gym/constants";
import { formatDate } from "@/lib/utils";
import { DateRangeFilter } from "./date-range-filter";

function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);
}

const VALID_RANGES: DateRangeKey[] = ["today", "week", "month", "last_month", "last_3_months", "year", "custom"];

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  await requirePermission("viewFinance");
  const { range: rangeParam, start, end } = await searchParams;
  const range: DateRangeKey = VALID_RANGES.includes(rangeParam as DateRangeKey) ? (rangeParam as DateRangeKey) : "month";
  const resolvedRange = resolveDateRange(range, start, end);

  const [hasData, ashbourneConnected, kpis, revenueOverTime, revenueByPlan, failedPayments] = await Promise.all([
    hasAnyPaymentData(),
    isAshbourneConnected(),
    getFinanceKpis(resolvedRange),
    getRevenueOverTime(12),
    getRevenueByPlan(),
    getFailedPayments(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Finances</h1>
        <p className="text-sm text-muted-foreground">Real revenue and payment data from this CRM — nothing fabricated.</p>
      </div>

      {!ashbourneConnected && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-warning-foreground">Ashbourne Membership Management isn&apos;t connected</p>
          <p className="mt-1 text-muted-foreground">
            Every figure below comes from payments and memberships entered manually in this CRM — showing
            manually-entered data only. Connect Ashbourne in{" "}
            <a href="/gym/integrations" className="text-primary hover:underline">
              Settings → Integrations
            </a>{" "}
            once API access is available for live financial data.
          </p>
        </div>
      )}

      {!hasData ? (
        <EmptyState
          icon={Wallet}
          title="No financial data yet"
          description="Ashbourne isn't connected, and no payments have been recorded manually yet. Record a payment on the Payments page, or assign a membership to a member, to see real revenue figures here — nothing on this page is ever estimated or fabricated."
          className="py-24"
        />
      ) : (
        <>
          <DateRangeFilter current={range} start={start} end={end} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <StatCard label="Revenue This Month" value={moneyGBP(kpis.revenueThisMonth)} icon={Wallet} tone="success" />
            <StatCard label="Revenue Last Month" value={moneyGBP(kpis.revenueLastMonth)} icon={CalendarDays} />
            <StatCard label="Projected Monthly Revenue" value={moneyGBP(kpis.projectedMonthlyRevenue)} icon={TrendingUp} tone="success" />
            <StatCard
              label="Outstanding Payments"
              value={moneyGBP(kpis.outstanding)}
              icon={AlertTriangle}
              tone={kpis.outstandingCount > 0 ? "warning" : "default"}
              hint={`${kpis.outstandingCount} pending`}
            />
            <StatCard
              label="Failed Payments"
              value={moneyGBP(kpis.failed)}
              icon={XCircle}
              tone={kpis.failedCount > 0 ? "destructive" : "default"}
              hint={`${kpis.failedCount} failed`}
            />
            <StatCard
              label="New Membership Revenue"
              value={moneyGBP(kpis.newMembershipRevenue)}
              icon={UserPlus}
              tone="success"
              hint="Selected period, monthly-normalized"
            />
            <StatCard
              label="Cancelled Membership Value"
              value={moneyGBP(kpis.cancelledMembershipValue)}
              icon={UserMinus}
              tone={kpis.cancelledMembershipValue > 0 ? "warning" : "default"}
              hint="Selected period, monthly-normalized"
            />
            <StatCard
              label="Revenue (Selected Period)"
              value={moneyGBP(kpis.rangeRevenue)}
              icon={BarChart3}
              hint={`${kpis.rangePaymentCount} payment${kpis.rangePaymentCount === 1 ? "" : "s"}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <ChartCard
              title="Revenue Over Time"
              subtitle="Recorded payments, last 12 months"
              isEmpty={revenueOverTime.every((r) => r.revenue === 0)}
              emptyIcon={Wallet}
              emptyMessage="No payment history in this window yet."
              className="xl:col-span-2"
            >
              <RevenueAreaChart data={revenueOverTime} />
            </ChartCard>

            <ChartCard
              title="Revenue by Plan"
              subtitle="Projected monthly, active memberships"
              isEmpty={revenueByPlan.length === 0}
              emptyIcon={BarChart3}
              emptyMessage="No active memberships assigned to a plan yet."
            >
              <RevenueByPlanChart data={revenueByPlan} />
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Failed Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {failedPayments.length === 0 ? (
                <EmptyState
                  icon={XCircle}
                  title="No failed payments"
                  description="Nothing needs attention right now."
                  className="border-none bg-transparent py-8"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.member?.fullName ?? "—"}</TableCell>
                        <TableCell>{moneyGBP(p.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                        <TableCell>
                          <GymStatusBadge list={PAYMENT_TX_STATUSES} value={p.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
