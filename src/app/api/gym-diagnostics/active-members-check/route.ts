import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTIVE_MEMBERSHIP_TYPES, ACTIVE_MEMBERSHIP_STATUSES } from "@/lib/gym/membership-rules";

/** TEMPORARY — read-only. Diagnosing why the Active Members KPI isn't
 * changing after Ashbourne syncs. No writes. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const totalMembers = await prisma.gymMember.count();
  const withAshbourneType = await prisma.gymMember.count({ where: { ashbourneMembershipType: { not: null } } });
  const withAshbourneStatus = await prisma.gymMember.count({ where: { ashbourneStatus: { not: null } } });

  const typeGroups = await prisma.gymMember.groupBy({
    by: ["ashbourneMembershipType"],
    _count: true,
    orderBy: { _count: { ashbourneMembershipType: "desc" } },
  });

  const statusGroups = await prisma.gymMember.groupBy({
    by: ["ashbourneStatus"],
    _count: true,
    orderBy: { _count: { ashbourneStatus: "desc" } },
  });

  // Reproduce the exact current getActiveMembershipCount() query.
  const currentKpiCount = await prisma.gymMember.count({
    where: {
      OR: [
        { ashbourneMembershipType: { in: [...ACTIVE_MEMBERSHIP_TYPES] }, ashbourneStatus: { in: [...ACTIVE_MEMBERSHIP_STATUSES] } },
        {
          ashbourneMembershipType: null,
          memberships: { some: { plan: { name: { in: [...ACTIVE_MEMBERSHIP_TYPES] } }, status: "ACTIVE" } },
        },
      ],
    },
  });

  // What the count would be via the plan-based fallback ALONE, ignoring
  // ashbourneMembershipType entirely (i.e. what it was before syncs ran).
  const planOnlyCount = await prisma.gymMember.count({
    where: { memberships: { some: { plan: { name: { in: [...ACTIVE_MEMBERSHIP_TYPES] } }, status: "ACTIVE" } } },
  });

  // Members that HAVE a non-null ashbourneMembershipType but whose type/status
  // doesn't exactly match the active vocabulary, AND whose plan-based fallback
  // would have said active. These are members the current query is dropping.
  const droppedMembers = await prisma.gymMember.findMany({
    where: {
      ashbourneMembershipType: { not: null },
      NOT: { ashbourneMembershipType: { in: [...ACTIVE_MEMBERSHIP_TYPES] }, ashbourneStatus: { in: [...ACTIVE_MEMBERSHIP_STATUSES] } },
      memberships: { some: { plan: { name: { in: [...ACTIVE_MEMBERSHIP_TYPES] } }, status: "ACTIVE" } },
    },
    select: { id: true, memberNumber: true, ashbourneMembershipType: true, ashbourneStatus: true },
    take: 20,
  });

  const latestSyncLog = await prisma.gymAshbourneSyncLog.findFirst({ orderBy: { startedAt: "desc" }, where: { dryRun: false } });

  return NextResponse.json({
    totalMembers,
    withAshbourneType,
    withAshbourneStatus,
    currentKpiCount,
    planOnlyCount,
    droppedMembersSample: droppedMembers,
    droppedMembersSampleCount: droppedMembers.length,
    typeGroups,
    statusGroups,
    latestSyncLog: latestSyncLog
      ? {
          startedAt: latestSyncLog.startedAt,
          recordsFound: latestSyncLog.recordsFound,
          created: latestSyncLog.created,
          updated: latestSyncLog.updated,
          unchanged: latestSyncLog.unchanged,
          reviewRequired: latestSyncLog.reviewRequired,
        }
      : null,
  });
}
