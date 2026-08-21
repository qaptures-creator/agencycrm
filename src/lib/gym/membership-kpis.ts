import "server-only";
import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ACTIVE_MEMBERSHIP_TYPES, ACTIVE_MEMBERSHIP_STATUSES, DAY_PASS_TYPE } from "./membership-rules";

/**
 * Centralized dashboard/Membership Snapshot KPI queries — the single
 * source of truth these consume, so they can never drift into two
 * different definitions. Business rules live in membership-rules.ts
 * (pure, unit-tested); this file only turns them into Prisma queries.
 *
 * Data reality (confirmed against production, 2026-08-21): the fields that
 * hold the exact Live/New/Defaulter/... vocabulary —
 * GymMember.ashbourneMembershipType/ashbourneStatus — are only populated
 * by a real (non-dry-run) Ashbourne Sync Now, which hasn't run yet, so
 * they're null for every member today. The type/status data that's
 * actually live comes from GymMembership.plan.name (matches the type
 * vocabulary exactly) and GymMembership.status (a coarser
 * ACTIVE/FROZEN/EXPIRED/OVERDUE enum — the fine status text was never
 * captured by either CSV importer). So: prefer the Ashbourne fields when a
 * member has them (future-proofs this once real syncs start writing them),
 * otherwise fall back to plan.name + status === "ACTIVE" as the closest
 * available proxy for "in force."
 */

const ACTIVE_TYPES_ARR = [...ACTIVE_MEMBERSHIP_TYPES];
const ACTIVE_STATUSES_ARR = [...ACTIVE_MEMBERSHIP_STATUSES];

/** Genuine ongoing memberships only — never Day Pass/PAYG/Cash Membership
 * Temp, regardless of status. Prefers synced Ashbourne fields on the member
 * when present, falls back to plan.name + GymMembership.status otherwise. */
export async function getActiveMembershipCount(): Promise<number> {
  return prisma.gymMember.count({
    where: {
      OR: [
        { ashbourneMembershipType: { in: ACTIVE_TYPES_ARR }, ashbourneStatus: { in: ACTIVE_STATUSES_ARR } },
        {
          ashbourneMembershipType: null,
          memberships: { some: { plan: { name: { in: ACTIVE_TYPES_ARR } }, status: "ACTIVE" } },
        },
      ],
    },
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
