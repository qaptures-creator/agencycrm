import "server-only";
import { prisma } from "@/lib/prisma";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  differenceInCalendarDays,
  subDays,
} from "date-fns";

export const REPORT_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
] as const;

export type ReportRangePreset = (typeof REPORT_RANGE_PRESETS)[number]["value"];

export type ResolvedRange = { from: Date; to: Date; prevFrom: Date; prevTo: Date; label: string };

export function resolveDateRange(preset: string | undefined, customFrom?: string, customTo?: string): ResolvedRange {
  const now = new Date();
  let from: Date;
  let to: Date;
  let label: string;

  switch (preset) {
    case "today":
      from = startOfDay(now);
      to = endOfDay(now);
      label = "Today";
      break;
    case "week":
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
      label = "This Week";
      break;
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      from = startOfMonth(lastMonth);
      to = endOfMonth(lastMonth);
      label = "Last Month";
      break;
    }
    case "last_3_months":
      from = startOfMonth(subMonths(now, 2));
      to = endOfMonth(now);
      label = "Last 3 Months";
      break;
    case "year":
      from = startOfYear(now);
      to = endOfYear(now);
      label = "This Year";
      break;
    case "custom":
      if (customFrom && customTo) {
        from = startOfDay(new Date(customFrom));
        to = endOfDay(new Date(customTo));
        label = "Custom Range";
      } else {
        from = startOfMonth(now);
        to = endOfMonth(now);
        label = "This Month";
      }
      break;
    case "month":
    default:
      from = startOfMonth(now);
      to = endOfMonth(now);
      label = "This Month";
      break;
  }

  const spanDays = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, spanDays - 1);

  return { from, to, prevFrom, prevTo, label };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function getMembershipReport(range: ResolvedRange) {
  const [activeMembers, newMembers, newMembersPrev, cancellations, cancellationsPrev, frozen] = await Promise.all([
    prisma.gymMember.count({ where: { memberships: { some: { status: "ACTIVE" } } } }),
    prisma.gymMember.count({ where: { joinDate: { gte: range.from, lte: range.to } } }),
    prisma.gymMember.count({ where: { joinDate: { gte: range.prevFrom, lte: range.prevTo } } }),
    prisma.gymMembership.count({ where: { status: "CANCELLED", cancelledAt: { gte: range.from, lte: range.to } } }),
    prisma.gymMembership.count({ where: { status: "CANCELLED", cancelledAt: { gte: range.prevFrom, lte: range.prevTo } } }),
    prisma.gymMembership.count({ where: { status: "FROZEN" } }),
  ]);

  return {
    activeMembers,
    newMembers,
    newMembersGrowthPct: pctChange(newMembers, newMembersPrev),
    cancellations,
    cancellationsGrowthPct: pctChange(cancellations, cancellationsPrev),
    frozen,
  };
}

// ---------------------------------------------------------------------------
// Revenue (finance-gated)
// ---------------------------------------------------------------------------

export async function getRevenueReport(range: ResolvedRange) {
  const [thisAgg, prevAgg, failedAgg, payments] = await Promise.all([
    prisma.gymPayment.aggregate({ _sum: { amount: true }, where: { status: "PAID", date: { gte: range.from, lte: range.to } } }),
    prisma.gymPayment.aggregate({ _sum: { amount: true }, where: { status: "PAID", date: { gte: range.prevFrom, lte: range.prevTo } } }),
    prisma.gymPayment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: "FAILED", date: { gte: range.from, lte: range.to } },
    }),
    prisma.gymPayment.findMany({
      where: { status: "PAID", date: { gte: range.from, lte: range.to } },
      select: {
        amount: true,
        member: {
          select: {
            memberships: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { plan: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const revenue = thisAgg._sum.amount ?? 0;
  const revenuePrev = prevAgg._sum.amount ?? 0;

  const byPlan = new Map<string, number>();
  for (const p of payments) {
    const planName = p.member?.memberships[0]?.plan.name ?? "Unassigned";
    byPlan.set(planName, (byPlan.get(planName) ?? 0) + p.amount);
  }
  const revenueByPlan = Array.from(byPlan.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    hasData: payments.length > 0 || revenuePrev > 0,
    revenue,
    revenuePrev,
    growthPct: pctChange(revenue, revenuePrev),
    failedCount: failedAgg._count,
    failedAmount: failedAgg._sum.amount ?? 0,
    revenueByPlan,
  };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function getLeadsReport(range: ResolvedRange) {
  const [leadsGenerated, leadsConverted, bySource] = await Promise.all([
    prisma.gymLead.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.gymLead.count({ where: { createdAt: { gte: range.from, lte: range.to }, stage: "JOINED" } }),
    prisma.gymLead.groupBy({
      by: ["source"],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
    }),
  ]);

  return {
    leadsGenerated,
    leadsConverted,
    conversionRate: leadsGenerated > 0 ? (leadsConverted / leadsGenerated) * 100 : 0,
    bySource: bySource.map((r) => ({ source: r.source, count: r._count._all })).sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function getStaffReport(range: ResolvedRange) {
  const [shifts, attendance, tasks] = await Promise.all([
    prisma.gymRotaShift.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: { startTime: true, endTime: true, breakMinutes: true },
    }),
    prisma.gymAttendance.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { clockInAt: true, clockOutAt: true },
    }),
    prisma.gymTask.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { status: true },
    }),
  ]);

  const scheduledHours = shifts.reduce((sum, s) => {
    const mins = (s.endTime.getTime() - s.startTime.getTime()) / 60000 - (s.breakMinutes ?? 0);
    return sum + Math.max(0, mins) / 60;
  }, 0);

  const completeAttendance = attendance.filter((a) => a.clockInAt && a.clockOutAt).length;
  const attendanceRate = attendance.length > 0 ? (completeAttendance / attendance.length) * 100 : 0;

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const taskCompletionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  return {
    scheduledHours: Math.round(scheduledHours * 10) / 10,
    shiftsCount: shifts.length,
    attendanceRecorded: attendance.length,
    attendanceComplete: completeAttendance,
    attendanceRate,
    tasksTotal: tasks.length,
    tasksCompleted: completedTasks,
    taskCompletionRate,
  };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export async function getOperationsReport(range: ResolvedRange) {
  const [openTickets, ticketsByStatus, incidentsThisPeriod, incidentsPrevPeriod, equipmentOutOfService] = await Promise.all([
    prisma.gymMaintenanceTicket.count({ where: { status: { not: "FIXED" } } }),
    prisma.gymMaintenanceTicket.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.gymIncident.count({ where: { occurredAt: { gte: range.from, lte: range.to } } }),
    prisma.gymIncident.count({ where: { occurredAt: { gte: range.prevFrom, lte: range.prevTo } } }),
    prisma.gymEquipment.count({ where: { condition: "OUT_OF_SERVICE" } }),
  ]);

  return {
    openTickets,
    ticketsByStatus: ticketsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    incidentsThisPeriod,
    incidentsPrevPeriod,
    incidentsTrendPct: pctChange(incidentsThisPeriod, incidentsPrevPeriod),
    equipmentOutOfService,
  };
}

// ---------------------------------------------------------------------------
// Trends (last 12 months — signups & revenue over time, independent of the
// selected report range so seasonality is visible regardless of filter)
// ---------------------------------------------------------------------------

function lastNMonths(n: number, ref = new Date()) {
  const months: { key: string; label: string; year: number; month: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

export async function getSignupsTrend(monthsBack = 12) {
  const months = lastNMonths(monthsBack);
  const since = new Date(months[0].year, months[0].month, 1);

  const members = await prisma.gymMember.findMany({
    where: { joinDate: { gte: since } },
    select: { joinDate: true },
  });

  return months.map(({ key, label, year, month }) => ({
    month: label,
    key,
    signups: members.filter((m) => m.joinDate.getFullYear() === year && m.joinDate.getMonth() === month).length,
  }));
}

export async function getRevenueTrend(monthsBack = 12) {
  const months = lastNMonths(monthsBack);
  const since = new Date(months[0].year, months[0].month, 1);

  const payments = await prisma.gymPayment.findMany({
    where: { status: "PAID", date: { gte: since } },
    select: { date: true, amount: true },
  });

  return months.map(({ key, label, year, month }) => ({
    month: label,
    key,
    revenue: payments
      .filter((p) => p.date.getFullYear() === year && p.date.getMonth() === month)
      .reduce((sum, p) => sum + p.amount, 0),
  }));
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  MEMBERSHIP: "Membership",
  JOINING_FEE: "Joining Fee",
  DAY_PASS: "Day Pass",
  OTHER: "Other",
};

export async function getPaymentTypeMix(range: ResolvedRange) {
  const rows = await prisma.gymPayment.groupBy({
    by: ["type"],
    where: { status: "PAID", date: { gte: range.from, lte: range.to } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  return rows
    .map((r) => ({ name: PAYMENT_TYPE_LABELS[r.type] ?? r.type, amount: r._sum.amount ?? 0, count: r._count._all }))
    .sort((a, b) => b.amount - a.amount);
}

export function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}
