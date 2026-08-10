import Link from "next/link";
import {
  Users,
  UserPlus,
  UserMinus,
  Wallet,
  AlertTriangle,
  Inbox,
  Target,
  UsersRound,
  ListChecks,
  TrendingUp,
  TrendingDown,
  BadgeAlert,
  Clock,
} from "lucide-react";
import { requireGymUser } from "@/lib/gym/auth";
import { can, roleLabel, type GymAccessRole } from "@/lib/gym/permissions";
import {
  getDashboardKpis,
  getTodayStaff,
  getTodayTasks,
  getRecentEnquiries,
  getRevenueSnapshot,
  getMembershipSnapshot,
  getAlerts,
} from "@/lib/gym/dashboard-data";
import { StatCard } from "@/components/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ChartCard } from "@/components/charts/chart-card";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { Badge, DotBadge } from "@/components/ui/badge";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { formatCurrency, formatDateTime, initials, cn } from "@/lib/utils";
import { TaskQuickComplete } from "@/components/gym/dashboard/task-quick-complete";
import { AnnouncementBanner } from "@/components/gym/announcement-banner";
import { MobileStaffHome } from "@/components/gym/mobile-staff-home";
import { ENQUIRY_STATUSES, ENQUIRY_CATEGORIES, TASK_PRIORITIES, labelFor, colorFor } from "@/lib/gym/constants";

function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}

export default async function GymDashboardPage() {
  const user = await requireGymUser();
  const role = user.accessRole as GymAccessRole;
  const showFinance = can(role, "viewFinance");

  const [kpis, todayStaff, todayTasks, recentEnquiries, membershipSnapshot, alerts, revenue] = await Promise.all([
    getDashboardKpis(),
    getTodayStaff(),
    getTodayTasks(),
    getRecentEnquiries(),
    getMembershipSnapshot(),
    getAlerts(),
    showFinance ? getRevenueSnapshot() : Promise.resolve(null),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-border pb-5">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Muscle Massacre Command Centre
        </p>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {roleLabel(role)}
          </p>
        </div>
      </div>

      <AnnouncementBanner />

      <MobileStaffHome userId={user.id} staffId={user.staff?.id ?? null} />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active Members" value={kpis.activeMembers} icon={Users} />
        <StatCard label="New Members This Month" value={kpis.newMembersThisMonth} icon={UserPlus} tone="success" />
        <StatCard label="Cancellations" value={kpis.cancellationsThisMonth} icon={UserMinus} tone={kpis.cancellationsThisMonth > 0 ? "warning" : "default"} />
        {showFinance ? (
          <StatCard label="Monthly Membership Revenue" value={moneyGBP(kpis.monthlyMembershipRevenue)} icon={Wallet} tone="success" />
        ) : (
          <StatCard label="Monthly Membership Revenue" value="Restricted" icon={Wallet} />
        )}
        {showFinance && (
          <StatCard
            label="Outstanding Payments"
            value={kpis.outstandingCount}
            icon={AlertTriangle}
            tone={kpis.outstandingCount > 0 ? "destructive" : "default"}
          />
        )}
        <StatCard label="New Enquiries" value={kpis.newEnquiries} icon={Inbox} />
        <StatCard label="Leads Awaiting Follow-Up" value={kpis.leadsAwaitingFollowUp} icon={Target} tone={kpis.leadsAwaitingFollowUp > 0 ? "warning" : "default"} />
        <StatCard label="Staff Currently Working" value={kpis.staffCurrentlyWorking} icon={UsersRound} tone="success" />
        <StatCard label="Tasks Due Today" value={kpis.tasksDueToday} icon={ListChecks} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Today's Staff */}
        <Card className="xl:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Today&apos;s Staff</CardTitle>
            <Link href="/gym/rota" className="text-xs text-primary hover:underline">
              View rota
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {todayStaff.length === 0 && (
              <EmptyState icon={UsersRound} title="No shifts scheduled today" className="border-none bg-transparent py-8" />
            )}
            {todayStaff.map((shift) => {
              const clockedIn = shift.attendance[0]?.clockInAt && !shift.attendance[0]?.clockOutAt;
              return (
                <div key={shift.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/40">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(shift.staff.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{shift.staff.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {shift.shiftRole || shift.staff.position} ·{" "}
                      {shift.startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–
                      {shift.endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Badge variant={clockedIn ? "success" : "secondary"} className="shrink-0">
                    {clockedIn ? "Clocked In" : "Not Clocked In"}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Today's Tasks */}
        <Card className="xl:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Today&apos;s Tasks</CardTitle>
            <Link href="/gym/tasks" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {todayTasks.length === 0 && (
              <EmptyState icon={ListChecks} title="Nothing due today" className="border-none bg-transparent py-8" />
            )}
            {todayTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/40">
                <TaskQuickComplete taskId={task.id} completed={task.status === "COMPLETED"} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", task.status === "COMPLETED" && "text-muted-foreground line-through")}>
                    {task.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {task.assignedTo?.fullName ?? "Unassigned"}
                    {task.dueTime && ` · ${task.dueTime}`}
                  </p>
                </div>
                <DotBadge color={colorFor(TASK_PRIORITIES, task.priority)}>{labelFor(TASK_PRIORITIES, task.priority)}</DotBadge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="xl:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Alerts</CardTitle>
            <BadgeAlert className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            {alerts.length === 0 && (
              <EmptyState icon={BadgeAlert} title="No alerts" description="Everything looks under control." className="border-none bg-transparent py-8" />
            )}
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.href}
                className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-secondary/40"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    alert.severity === "urgent" && "bg-destructive",
                    alert.severity === "warning" && "bg-warning",
                    alert.severity === "info" && "bg-primary"
                  )}
                />
                <span className="text-foreground/90">{alert.message}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Recent Enquiries */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Recent Enquiries</CardTitle>
            <Link href="/gym/enquiries" className="text-xs text-primary hover:underline">
              Open inbox
            </Link>
          </CardHeader>
          <CardContent>
            {recentEnquiries.length === 0 ? (
              <EmptyState icon={Inbox} title="No enquiries yet" description="New enquiries will appear here." className="border-none bg-transparent py-10" />
            ) : (
              <div className="divide-y divide-border/60">
                {recentEnquiries.map((e) => (
                  <Link key={e.id} href={`/gym/enquiries?enquiry=${e.id}`} className="flex items-center gap-3 py-2.5 hover:bg-secondary/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{e.name}</p>
                        <Badge variant="outline" className="shrink-0">{labelFor(ENQUIRY_CATEGORIES, e.category)}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.email || e.phone || "No contact info"} · {formatDateTime(e.createdAt)}
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {e.assignedTo?.fullName ?? "Unassigned"}
                    </span>
                    <GymStatusBadge list={ENQUIRY_STATUSES} value={e.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Membership snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Membership Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <MiniStat label="Total Active" value={membershipSnapshot.totalActive} />
            <MiniStat label="New Joins" value={membershipSnapshot.newJoins} tone="success" />
            <MiniStat label="Cancellations" value={membershipSnapshot.cancellations} tone="destructive" />
            <MiniStat label="Freezes" value={membershipSnapshot.frozen} />
            <MiniStat label="Expired" value={membershipSnapshot.expired} />
            <MiniStat label="Overdue" value={membershipSnapshot.overdue} tone="warning" />
          </CardContent>
        </Card>
      </div>

      {/* Revenue snapshot */}
      {showFinance && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <ChartCard
            title="Revenue Snapshot"
            subtitle="Recorded payments, last 6 months"
            isEmpty={!revenue?.hasData}
            emptyIcon={Wallet}
            emptyMessage="No payment data recorded yet. Connect Ashbourne in Settings → Integrations, or record payments manually, to see real revenue here."
            className="xl:col-span-2"
          >
            {revenue && <RevenueAreaChart data={revenue.chartData} />}
          </ChartCard>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">This Month vs Last</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {revenue?.hasData ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">This month</span>
                    <span className="text-lg font-semibold">{moneyGBP(revenue.revenueThisMonth)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Last month</span>
                    <span className="text-sm text-muted-foreground">{moneyGBP(revenue.revenueLastMonth)}</span>
                  </div>
                  {revenue.pctChange !== null && (
                    <div className="flex items-center gap-1.5 text-sm">
                      {revenue.pctChange >= 0 ? (
                        <TrendingUp className="size-4 text-success" />
                      ) : (
                        <TrendingDown className="size-4 text-destructive" />
                      )}
                      <span className={revenue.pctChange >= 0 ? "text-success" : "text-destructive"}>
                        {revenue.pctChange.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Outstanding</span>
                      <span className="text-warning-foreground">{moneyGBP(revenue.outstanding)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed payments</span>
                      <span className="text-destructive">
                        {revenue.failedCount} ({moneyGBP(revenue.failedAmount)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Refunds</span>
                      <span>{moneyGBP(revenue.refunded)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState icon={Clock} title="Not connected" description="No payment provider connected yet." className="border-none bg-transparent py-6" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning-foreground",
          tone === "destructive" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}
