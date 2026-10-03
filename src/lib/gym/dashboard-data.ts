import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, differenceInDays } from "date-fns";
import { getActiveMembershipCount, getNewMembershipsThisMonth, getDayPassesThisMonth } from "./membership-kpis";
import { getLatestAshbourneSyncLog } from "@/lib/ashbourne/sync";

const STALE_SYNC_DAYS = 7;

const MONTHLY_MULTIPLIER: Record<string, number> = { WEEKLY: 52 / 12, MONTHLY: 1, ANNUAL: 1 / 12 };

function toMonthly(amount: number, frequency: string) {
  return amount * (MONTHLY_MULTIPLIER[frequency] ?? 1);
}

export async function getDashboardKpis() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const [
    activeMembers,
    newMembersThisMonth,
    dayPassesThisMonth,
    cancellationsThisMonth,
    activeMemberships,
    outstandingCount,
    newEnquiries,
    leadsAwaitingFollowUp,
    staffCurrentlyWorking,
    tasksDueToday,
  ] = await Promise.all([
    getActiveMembershipCount(),
    getNewMembershipsThisMonth(now),
    getDayPassesThisMonth(now),
    prisma.gymMembership.count({ where: { status: "CANCELLED", cancelledAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.gymMembership.findMany({ where: { status: "ACTIVE" }, select: { billingAmount: true, paymentFrequency: true } }),
    prisma.gymMembership.count({ where: { paymentStatus: { in: ["OVERDUE", "FAILED"] } } }),
    prisma.gymEnquiry.count({ where: { status: "NEW" } }),
    prisma.gymLead.count({
      where: { nextFollowUpAt: { lte: now }, stage: { notIn: ["JOINED", "LOST"] } },
    }),
    prisma.gymAttendance.count({ where: { clockInAt: { not: null }, clockOutAt: null } }),
    prisma.gymTask.count({
      where: { status: { not: "COMPLETED" }, dueDate: { gte: dayStart, lte: dayEnd } },
    }),
  ]);

  const monthlyMembershipRevenue = activeMemberships.reduce(
    (sum, m) => sum + toMonthly(m.billingAmount, m.paymentFrequency),
    0
  );

  return {
    activeMembers,
    newMembersThisMonth,
    dayPassesThisMonth,
    cancellationsThisMonth,
    monthlyMembershipRevenue,
    outstandingCount,
    newEnquiries,
    leadsAwaitingFollowUp,
    staffCurrentlyWorking,
    tasksDueToday,
  };
}

export type CancellationRow = {
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  planName: string;
  cancelledAt: Date | null;
};

/** The actual memberships behind the "Cancellations This Month" KPI — same
 * status+cancelledAt WHERE as getDashboardKpis, so the export always
 * matches the number on the card. Manually-recorded only: Ashbourne's
 * export has no cancellation signal, so every CANCELLED row here was set
 * by staff in the CRM, never by a sync (see membership-rules.ts). */
export async function getCancellationsThisMonthRecords(reference: Date = new Date()): Promise<CancellationRow[]> {
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  const rows = await prisma.gymMembership.findMany({
    where: { status: "CANCELLED", cancelledAt: { gte: monthStart, lte: monthEnd } },
    orderBy: { cancelledAt: "desc" },
    include: { member: true, plan: true },
  });
  return rows.map((r) => ({
    memberNumber: r.member.memberNumber,
    fullName: r.member.fullName,
    email: r.member.email,
    phone: r.member.phone,
    planName: r.plan.name,
    cancelledAt: r.cancelledAt,
  }));
}

/** Every enquiry, most recent first — the full set behind the Recent
 * Enquiries card (which only ever shows the latest few on screen). */
export async function getEnquiriesForExport() {
  return prisma.gymEnquiry.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignedTo: true },
  });
}

export async function getTodayStaff() {
  const today = new Date();
  const shifts = await prisma.gymRotaShift.findMany({
    where: { date: { gte: startOfDay(today), lte: endOfDay(today) } },
    include: {
      staff: true,
      attendance: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { startTime: "asc" },
  });
  return shifts;
}

export async function getTodayTasks() {
  const today = new Date();
  return prisma.gymTask.findMany({
    where: {
      status: { not: "COMPLETED" },
      OR: [{ dueDate: { gte: startOfDay(today), lte: endOfDay(today) } }, { recurrence: "DAILY" }],
    },
    include: { assignedTo: true },
    orderBy: [{ priority: "desc" }, { dueTime: "asc" }],
    take: 8,
  });
}

export async function getRecentEnquiries(take = 6) {
  return prisma.gymEnquiry.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignedTo: true },
    take,
  });
}

export async function getRevenueSnapshot() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [thisMonthAgg, lastMonthAgg, outstandingAgg, failedAgg, refundedAgg, chartRows, totalPayments] =
    await Promise.all([
      prisma.gymPayment.aggregate({ _sum: { amount: true }, where: { status: "PAID", date: { gte: monthStart } } }),
      prisma.gymPayment.aggregate({
        _sum: { amount: true },
        where: { status: "PAID", date: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.gymPayment.aggregate({ _sum: { amount: true }, where: { status: "PENDING" } }),
      prisma.gymPayment.aggregate({ _sum: { amount: true }, _count: true, where: { status: "FAILED" } }),
      prisma.gymPayment.aggregate({ _sum: { amount: true }, where: { status: "REFUNDED" } }),
      prisma.gymPayment.findMany({
        where: { status: "PAID", date: { gte: startOfMonth(subMonths(now, 5)) } },
        select: { amount: true, date: true },
      }),
      prisma.gymPayment.count(),
    ]);

  const revenueThisMonth = thisMonthAgg._sum.amount ?? 0;
  const revenueLastMonth = lastMonthAgg._sum.amount ?? 0;
  const pctChange = revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : null;

  const monthBuckets: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const key = startOfMonth(subMonths(now, i)).toLocaleDateString("en-GB", { month: "short" });
    monthBuckets[key] = 0;
  }
  for (const row of chartRows) {
    const key = row.date.toLocaleDateString("en-GB", { month: "short" });
    if (key in monthBuckets) monthBuckets[key] += row.amount;
  }
  const chartData = Object.entries(monthBuckets).map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }));

  return {
    hasData: totalPayments > 0,
    revenueThisMonth,
    revenueLastMonth,
    pctChange,
    outstanding: outstandingAgg._sum.amount ?? 0,
    failedAmount: failedAgg._sum.amount ?? 0,
    failedCount: failedAgg._count,
    refunded: refundedAgg._sum.amount ?? 0,
    chartData,
  };
}

export async function getMembershipSnapshot() {
  const now = new Date();
  const monthStart = startOfMonth(now);

  // totalActive/newJoins reuse the exact same helpers as the top-level
  // dashboard cards (getActiveMembershipCount/getNewMembershipsThisMonth)
  // so there's a single definition of each, never two that can drift.
  // cancellations/frozen/expired/overdue are unchanged — still membership-
  // row counts across all plan types, out of scope for this pass.
  const [totalActive, newJoins, cancellations, frozen, expired, overdue] = await Promise.all([
    getActiveMembershipCount(),
    getNewMembershipsThisMonth(now),
    prisma.gymMembership.count({ where: { status: "CANCELLED", cancelledAt: { gte: monthStart } } }),
    prisma.gymMembership.count({ where: { status: "FROZEN" } }),
    prisma.gymMembership.count({ where: { status: "EXPIRED" } }),
    prisma.gymMembership.count({ where: { paymentStatus: "OVERDUE" } }),
  ]);

  return { totalActive, newJoins, cancellations, frozen, expired, overdue };
}

export type Alert = {
  id: string;
  severity: "urgent" | "warning" | "info";
  message: string;
  href: string;
};

export async function getAlerts(): Promise<Alert[]> {
  const now = new Date();
  const alerts: Alert[] = [];

  const [failedPayments, cancellations, equipmentIssues, urgentMaintenance, overdueTasks, lowStock, urgentIncidents, latestSync] =
    await Promise.all([
      prisma.gymPayment.findMany({ where: { status: "FAILED" }, include: { member: true }, take: 5, orderBy: { date: "desc" } }),
      prisma.gymMembership.findMany({
        where: { status: "CANCELLED", cancelledAt: { gte: startOfWeek(now), lte: endOfWeek(now) } },
        include: { member: true },
        take: 5,
      }),
      prisma.gymEquipment.findMany({ where: { condition: "OUT_OF_SERVICE" }, take: 5 }),
      prisma.gymMaintenanceTicket.findMany({
        where: { priority: "URGENT", status: { notIn: ["FIXED"] } },
        take: 5,
      }),
      prisma.gymTask.findMany({ where: { status: { not: "COMPLETED" }, dueDate: { lt: startOfDay(now) } }, take: 5 }),
      prisma.gymShakeBarProduct.findMany({ take: 50 }),
      prisma.gymIncident.findMany({
        where: { followUpRequired: true, createdAt: { gte: startOfWeek(now) } },
        take: 5,
      }),
      getLatestAshbourneSyncLog(),
    ]);

  const syncAgeDays = latestSync?.completedAt ? differenceInDays(now, latestSync.completedAt) : null;
  if (syncAgeDays === null || syncAgeDays > STALE_SYNC_DAYS) {
    alerts.push({
      id: "ashbourne-sync-stale",
      severity: "warning",
      message: syncAgeDays === null ? "Member data has never been synced from Ashbourne" : `Member data last synced ${syncAgeDays} days ago — run Sync Now`,
      href: "/gym/integrations",
    });
  }

  for (const p of failedPayments) {
    alerts.push({
      id: `pay-${p.id}`,
      severity: "urgent",
      message: `Failed payment${p.member ? ` — ${p.member.fullName}` : ""} (£${p.amount.toFixed(2)})`,
      href: "/gym/payments",
    });
  }
  for (const c of cancellations) {
    alerts.push({
      id: `cancel-${c.id}`,
      severity: "warning",
      message: `Membership cancelled — ${c.member.fullName}`,
      href: `/gym/members/${c.memberId}`,
    });
  }
  for (const e of equipmentIssues) {
    alerts.push({ id: `equip-${e.id}`, severity: "warning", message: `Equipment out of service — ${e.name}`, href: "/gym/equipment" });
  }
  for (const m of urgentMaintenance) {
    alerts.push({ id: `maint-${m.id}`, severity: "urgent", message: `Urgent maintenance ticket — ${m.issue}`, href: "/gym/maintenance" });
  }
  for (const t of overdueTasks) {
    alerts.push({ id: `task-${t.id}`, severity: "warning", message: `Task overdue — ${t.title}`, href: "/gym/tasks" });
  }
  for (const p of lowStock) {
    if (p.stock <= p.lowStockLevel) {
      alerts.push({ id: `stock-${p.id}`, severity: "warning", message: `Low stock — ${p.name} (${p.stock} left)`, href: "/gym/shake-bar" });
    }
  }
  for (const i of urgentIncidents) {
    alerts.push({ id: `incident-${i.id}`, severity: "urgent", message: `Incident needs follow-up — ${i.category.replace(/_/g, " ")}`, href: "/gym/incidents" });
  }

  return alerts.slice(0, 12);
}
