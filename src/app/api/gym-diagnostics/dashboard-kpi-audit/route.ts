import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — read-only audit of the dashboard KPI data model, requested
 * before any KPI logic changes. Purely SELECTs (count/groupBy/findMany) —
 * no writes. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const ACTIVE_TYPES = ["12 Month Contract", "Presale Membership", "Rolling Membership"];
  const ACTIVE_STATUSES = ["Live", "New", "Defaulter", "Paid in Full"];

  const [
    oldActiveMembers,
    oldNewMembersThisMonth,
    totalMembers,
    planStatusGroups,
    plans,
    ashbourneTypeGroups,
    ashbourneStatusGroups,
    ashbourneTypeNonNull,
    ashbourneStatusNonNull,
    membersThisMonthWithPlan,
    newActiveByAshbourne,
  ] = await Promise.all([
    prisma.gymMember.count({ where: { memberships: { some: { status: "ACTIVE" } } } } ),
    prisma.gymMember.count({ where: { joinDate: { gte: monthStart, lte: monthEnd } } }),
    prisma.gymMember.count(),
    prisma.gymMembership.groupBy({ by: ["planId", "status"], _count: { _all: true } }),
    prisma.gymMembershipPlan.findMany({ select: { id: true, name: true } }),
    prisma.gymMember.groupBy({ by: ["ashbourneMembershipType"], _count: { _all: true } }),
    prisma.gymMember.groupBy({ by: ["ashbourneStatus"], _count: { _all: true } }),
    prisma.gymMember.count({ where: { ashbourneMembershipType: { not: null } } }),
    prisma.gymMember.count({ where: { ashbourneStatus: { not: null } } }),
    prisma.gymMember.findMany({
      where: { joinDate: { gte: monthStart, lte: monthEnd } },
      select: { memberships: { select: { plan: { select: { name: true } } }, take: 1 } },
    }),
    prisma.gymMember.groupBy({
      by: ["ashbourneMembershipType", "ashbourneStatus"],
      where: { ashbourneMembershipType: { in: ACTIVE_TYPES }, ashbourneStatus: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    }),
  ]);

  const planNameById = new Map(plans.map((p) => [p.id, p.name]));
  const planStatusBreakdown = planStatusGroups.map((g) => ({
    planName: planNameById.get(g.planId) ?? "(unknown plan)",
    status: g.status,
    count: g._count._all,
  }));

  // Distinct plan names + total membership count per plan (any status) —
  // this is what's ACTUALLY driving "Membership Type" on the Members page
  // today (member-list.tsx renders membership.planName).
  const planTotals = new Map<string, number>();
  for (const row of planStatusBreakdown) {
    planTotals.set(row.planName, (planTotals.get(row.planName) ?? 0) + row.count);
  }

  // "Active Members" per the NEW business rule, but using plan.name (the
  // field that's actually populated) instead of ashbourneMembershipType
  // (which is barely populated — see ashbourneTypeNonNull below), and
  // treating GymMembership.status === "ACTIVE" as a stand-in since the
  // fine-grained Live/New/Defaulter/Paid in Full status was never captured
  // by either CSV importer.
  const activeTypeCandidateTotal = planStatusBreakdown
    .filter((r) => ACTIVE_TYPES.includes(r.planName) && r.status === "ACTIVE")
    .reduce((s, r) => s + r.count, 0);

  const newMembersThisMonthByPlan = new Map<string, number>();
  for (const m of membersThisMonthWithPlan) {
    const name = m.memberships[0]?.plan.name ?? "(no membership)";
    newMembersThisMonthByPlan.set(name, (newMembersThisMonthByPlan.get(name) ?? 0) + 1);
  }

  const dayPassesThisMonth = newMembersThisMonthByPlan.get("Day Pass") ?? 0;
  const newActiveMembersThisMonth = ACTIVE_TYPES.reduce((s, t) => s + (newMembersThisMonthByPlan.get(t) ?? 0), 0);

  return NextResponse.json({
    totalMembers,
    old: {
      activeMembers: oldActiveMembers,
      newMembersThisMonth: oldNewMembersThisMonth,
    },
    dataModelFindings: {
      note:
        "ashbourneMembershipType/ashbourneStatus (the fields matching your Live/New/Defaulter/Day Pass vocabulary exactly) are only populated by a REAL Ashbourne BI Sync Now, which has never been run yet (only Dry Runs, which write nothing). The type/status data that's actually live for existing members comes from GymMembershipPlan.name and GymMembership.status instead, populated by the two CSV importers — but the CSV importers never captured the fine-grained Live/New/Defaulter/Paid in Full status at all, only a coarse ACTIVE/FROZEN/CANCELLED/EXPIRED/OVERDUE enum that defaults to ACTIVE for every plan type including Day Pass and is never transitioned later.",
      ashbourneMembershipTypeNonNullCount: ashbourneTypeNonNull,
      ashbourneStatusNonNullCount: ashbourneStatusNonNull,
      ashbourneMembershipTypeDistinct: ashbourneTypeGroups.map((g) => ({ value: g.ashbourneMembershipType, count: g._count._all })),
      ashbourneStatusDistinct: ashbourneStatusGroups.map((g) => ({ value: g.ashbourneStatus, count: g._count._all })),
      planNamesWithTotalMembershipCount: Array.from(planTotals.entries()).map(([name, count]) => ({ name, count })),
      membershipStatusDistinct: Array.from(new Set(planStatusBreakdown.map((r) => r.status))),
    },
    newDefinitionUsingAshbourneFieldsLiterally: {
      note: "Business rule as literally specified (ashbourneMembershipType IN active types AND ashbourneStatus IN active statuses) — expected near-zero today given the population counts above.",
      activeMembersCount: newActiveByAshbourne.reduce((s, r) => s + r._count._all, 0),
      breakdown: newActiveByAshbourne.map((r) => ({ type: r.ashbourneMembershipType, status: r.ashbourneStatus, count: r._count._all })),
    },
    newDefinitionUsingPlanNameAndMembershipStatus: {
      note: "Using GymMembershipPlan.name (the field actually populated) for membership type, and GymMembership.status === 'ACTIVE' as the closest available stand-in for 'genuinely ongoing' since Live/New/Defaulter/Paid in Full was never captured.",
      activeMembersCount: activeTypeCandidateTotal,
      breakdownByPlanAndStatus: planStatusBreakdown.filter((r) => ACTIVE_TYPES.includes(r.planName)),
      dayPassBreakdown: planStatusBreakdown.filter((r) => r.planName === "Day Pass"),
    },
    thisMonthJoinsByPlan: Array.from(newMembersThisMonthByPlan.entries()).map(([name, count]) => ({ name, count })),
    newMembersThisMonthCandidate: newActiveMembersThisMonth,
    dayPassesThisMonthCandidate: dayPassesThisMonth,
    databaseChanged: false,
  });
}
