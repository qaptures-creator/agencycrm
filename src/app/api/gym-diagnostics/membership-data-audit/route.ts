import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — read-only. Auditing membership status/date data quality
 * before deciding how to make Active Members/etc. date-derived instead of
 * trusting the stored, never-recalculated `status` field. No writes.
 * Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const now = new Date();

  const [
    membershipStatusCounts,
    paymentStatusCounts,
    memberCreatedRange,
    memberUpdatedRange,
    membershipCreatedRange,
    membershipUpdatedRange,
    totalMembers,
    totalMemberships,
    activeWithPastRenewal,
    activeWithNoRenewal,
    activeWithFutureRenewal,
    allWithNoRenewal,
    expiredWithFutureRenewal,
    frozenCount,
    frozenWithNoFreezeDates,
    cancelledCount,
    cancelledWithNoCancelledAt,
    membershipsBySource,
    sampleActiveMemberships,
  ] = await Promise.all([
    prisma.gymMembership.groupBy({ by: ["status"], _count: true, orderBy: { _count: { status: "desc" } } }),
    prisma.gymMembership.groupBy({ by: ["paymentStatus"], _count: true, orderBy: { _count: { paymentStatus: "desc" } } }),
    prisma.gymMember.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
    prisma.gymMember.aggregate({ _min: { updatedAt: true }, _max: { updatedAt: true } }),
    prisma.gymMembership.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
    prisma.gymMembership.aggregate({ _min: { updatedAt: true }, _max: { updatedAt: true } }),
    prisma.gymMember.count(),
    prisma.gymMembership.count(),
    prisma.gymMembership.count({ where: { status: "ACTIVE", renewalDate: { lt: now } } }),
    prisma.gymMembership.count({ where: { status: "ACTIVE", renewalDate: null } }),
    prisma.gymMembership.count({ where: { status: "ACTIVE", renewalDate: { gte: now } } }),
    prisma.gymMembership.count({ where: { renewalDate: null } }),
    prisma.gymMembership.count({ where: { status: "EXPIRED", renewalDate: { gte: now } } }),
    prisma.gymMembership.count({ where: { status: "FROZEN" } }),
    prisma.gymMembership.count({ where: { status: "FROZEN", freezeStart: null, freezeEnd: null } }),
    prisma.gymMembership.count({ where: { status: "CANCELLED" } }),
    prisma.gymMembership.count({ where: { status: "CANCELLED", cancelledAt: null } }),
    prisma.gymMembership.groupBy({ by: ["source"], _count: true }),
    prisma.gymMembership.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, startDate: true, renewalDate: true, status: true, paymentStatus: true, source: true },
      take: 10,
      orderBy: { startDate: "desc" },
    }),
  ]);

  return NextResponse.json({
    totalMembers,
    totalMemberships,
    membershipStatusCounts,
    paymentStatusCounts,
    membershipsBySource,
    memberCreatedRange,
    memberUpdatedRange,
    membershipCreatedRange,
    membershipUpdatedRange,
    dateQuality: {
      activeWithPastRenewal_shouldBeExpiredButIsnt: activeWithPastRenewal,
      activeWithNoRenewalDate_rollingOrUnknown: activeWithNoRenewal,
      activeWithFutureRenewal_genuinelyOk: activeWithFutureRenewal,
      anyStatusWithNoRenewalDateAtAll: allWithNoRenewal,
      expiredStatusButRenewalDateInFuture_inconsistent: expiredWithFutureRenewal,
      frozenCount,
      frozenWithNoFreezeStartOrEnd: frozenWithNoFreezeDates,
      cancelledCount,
      cancelledWithNoCancelledAt,
    },
    sampleActiveMemberships,
  });
}
