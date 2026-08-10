import "server-only";
import { prisma } from "@/lib/prisma";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
} from "date-fns";
import { type DateRangeKey } from "@/lib/gym/finance-range";

export { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/gym/finance-range";

// Same normalization formula as src/lib/gym/dashboard-data.ts's toMonthly() —
// kept in sync here since that file must not be edited.
const MONTHLY_MULTIPLIER: Record<string, number> = { WEEKLY: 52 / 12, MONTHLY: 1, ANNUAL: 1 / 12 };
function toMonthly(amount: number, frequency: string) {
  return amount * (MONTHLY_MULTIPLIER[frequency] ?? 1);
}

export function resolveDateRange(key: DateRangeKey, customStart?: string, customEnd?: string) {
  const now = new Date();
  switch (key) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case "last_3_months":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom": {
      const start = customStart ? startOfDay(new Date(customStart)) : startOfMonth(now);
      const end = customEnd ? endOfDay(new Date(customEnd)) : endOfMonth(now);
      return { start, end };
    }
    case "month":
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export async function hasAnyPaymentData() {
  const count = await prisma.gymPayment.count();
  return count > 0;
}

export async function getFinanceKpis(range: { start: Date; end: Date }) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [
    rangeRevenueAgg,
    thisMonthAgg,
    lastMonthAgg,
    outstandingAgg,
    failedAgg,
    activeMemberships,
    newMembershipsInRange,
    cancelledInRange,
  ] = await Promise.all([
    prisma.gymPayment.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: "PAID", date: { gte: range.start, lte: range.end } },
    }),
    prisma.gymPayment.aggregate({ _sum: { amount: true }, where: { status: "PAID", date: { gte: monthStart, lte: monthEnd } } }),
    prisma.gymPayment.aggregate({
      _sum: { amount: true },
      where: { status: "PAID", date: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    prisma.gymPayment.aggregate({ _sum: { amount: true }, _count: true, where: { status: "PENDING" } }),
    prisma.gymPayment.aggregate({ _sum: { amount: true }, _count: true, where: { status: "FAILED" } }),
    prisma.gymMembership.findMany({ where: { status: "ACTIVE" }, select: { billingAmount: true, paymentFrequency: true } }),
    prisma.gymMembership.findMany({
      where: { startDate: { gte: range.start, lte: range.end } },
      select: { billingAmount: true, paymentFrequency: true },
    }),
    prisma.gymMembership.findMany({
      where: { status: "CANCELLED", cancelledAt: { gte: range.start, lte: range.end } },
      select: { billingAmount: true, paymentFrequency: true },
    }),
  ]);

  const projectedMonthlyRevenue = activeMemberships.reduce((sum, m) => sum + toMonthly(m.billingAmount, m.paymentFrequency), 0);
  const newMembershipRevenue = newMembershipsInRange.reduce((sum, m) => sum + toMonthly(m.billingAmount, m.paymentFrequency), 0);
  const cancelledMembershipValue = cancelledInRange.reduce((sum, m) => sum + toMonthly(m.billingAmount, m.paymentFrequency), 0);

  return {
    rangeRevenue: rangeRevenueAgg._sum.amount ?? 0,
    rangePaymentCount: rangeRevenueAgg._count,
    revenueThisMonth: thisMonthAgg._sum.amount ?? 0,
    revenueLastMonth: lastMonthAgg._sum.amount ?? 0,
    projectedMonthlyRevenue,
    outstanding: outstandingAgg._sum.amount ?? 0,
    outstandingCount: outstandingAgg._count,
    failed: failedAgg._sum.amount ?? 0,
    failedCount: failedAgg._count,
    newMembershipRevenue,
    cancelledMembershipValue,
  };
}

export async function getRevenueOverTime(months = 12) {
  const now = new Date();
  const since = startOfMonth(subMonths(now, months - 1));
  const rows = await prisma.gymPayment.findMany({
    where: { status: "PAID", date: { gte: since } },
    select: { amount: true, date: true },
  });

  const buckets: Record<string, number> = {};
  for (let i = months - 1; i >= 0; i--) {
    const key = startOfMonth(subMonths(now, i)).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    buckets[key] = 0;
  }
  for (const row of rows) {
    const key = row.date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    if (key in buckets) buckets[key] += row.amount;
  }
  return Object.entries(buckets).map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }));
}

export async function getRevenueByPlan() {
  const memberships = await prisma.gymMembership.findMany({
    where: { status: "ACTIVE" },
    select: { billingAmount: true, paymentFrequency: true, plan: { select: { name: true } } },
  });

  const byPlan: Record<string, number> = {};
  for (const m of memberships) {
    const key = m.plan.name;
    byPlan[key] = (byPlan[key] ?? 0) + toMonthly(m.billingAmount, m.paymentFrequency);
  }
  return Object.entries(byPlan)
    .map(([name, monthlyRevenue]) => ({ name, monthlyRevenue: Math.round(monthlyRevenue) }))
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
}

export async function getFailedPayments(take = 25) {
  return prisma.gymPayment.findMany({
    where: { status: "FAILED" },
    include: { member: true },
    orderBy: { date: "desc" },
    take,
  });
}
