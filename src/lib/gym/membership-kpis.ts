import "server-only";
import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ACTIVE_MEMBERSHIP_TYPES, DAY_PASS_TYPE } from "./membership-rules";

/**
 * Centralized dashboard/Membership Snapshot KPI queries — the single
 * source of truth these consume, so they can never drift into two
 * different definitions. Business rules live in membership-rules.ts
 * (pure, unit-tested); this file only turns them into Prisma queries.
 *
 * Active Members (Phase 12 rewrite): reads GymMembership.status/plan.name
 * directly — the same table Frozen/Expired/Overdue/Cancellations already
 * read (see dashboard-data.ts) — instead of the GymMember-level
 * ashbourneMembershipType/ashbourneStatus fields this used previously. That
 * older approach silently matched nothing once real Ashbourne syncs started
 * writing those fields in ALL CAPS ("LIVE", "12 MONTH CONTRACT") against a
 * Title Case `in` list — status is now computed by the one shared
 * deriveMembershipStatus function at sync time (see ashbourne/sync.ts) and
 * plan.name is canonicalized to a consistent casing there too, so a plain
 * exact match here is reliable without any case workaround.
 */

const ACTIVE_TYPES_ARR = [...ACTIVE_MEMBERSHIP_TYPES];

/** Genuine ongoing memberships only — never Day Pass/PAYG/Cash Membership
 * Temp, regardless of status. */
export async function getActiveMembershipCount(): Promise<number> {
  return prisma.gymMembership.count({
    where: { status: "ACTIVE", plan: { name: { in: ACTIVE_TYPES_ARR } } },
  });
}

/** Genuine ongoing memberships that joined in the given month — status-
 * independent (measures acquisition, not current standing), per the
 * business rule: someone who joined this month and is now Defaulter still
 * counts. */
export async function getNewMembershipsThisMonth(reference: Date = new Date()): Promise<number> {
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  return prisma.gymMember.count({
    where: {
      joinDate: { gte: monthStart, lte: monthEnd },
      OR: [
        { ashbourneMembershipType: { in: ACTIVE_TYPES_ARR } },
        { ashbourneMembershipType: null, memberships: { some: { plan: { name: { in: ACTIVE_TYPES_ARR } } } } },
      ],
    },
  });
}

/** Day Pass records that joined in the given month — status-independent
 * (Complete/Expired/Paid in Full all still count; it's asking how many Day
 * Passes were sold this month, not their current state). */
export async function getDayPassesThisMonth(reference: Date = new Date()): Promise<number> {
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  return prisma.gymMember.count({
    where: {
      joinDate: { gte: monthStart, lte: monthEnd },
      OR: [
        { ashbourneMembershipType: DAY_PASS_TYPE },
        { ashbourneMembershipType: null, memberships: { some: { plan: { name: DAY_PASS_TYPE } } } },
      ],
    },
  });
}
