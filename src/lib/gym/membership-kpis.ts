import "server-only";
import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
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

/** Shared WHERE for "joined this month" + a membership type set — used by
 * both the count (dashboard KPI) and the record export, so the CSV can
 * never list a different set of members than the number on the card. */
function newJoinsWhere(reference: Date, types: string[]): Prisma.GymMemberWhereInput {
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  return {
    joinDate: { gte: monthStart, lte: monthEnd },
    OR: [
      { ashbourneMembershipType: { in: types } },
      { ashbourneMembershipType: null, memberships: { some: { plan: { name: { in: types } } } } },
    ],
  };
}

/** Genuine ongoing memberships that joined in the given month — status-
 * independent (measures acquisition, not current standing), per the
 * business rule: someone who joined this month and is now Defaulter still
 * counts. */
export async function getNewMembershipsThisMonth(reference: Date = new Date()): Promise<number> {
  return prisma.gymMember.count({ where: newJoinsWhere(reference, ACTIVE_TYPES_ARR) });
}

/** Day Pass records that joined in the given month — status-independent
 * (Complete/Expired/Paid in Full all still count; it's asking how many Day
 * Passes were sold this month, not their current state). */
export async function getDayPassesThisMonth(reference: Date = new Date()): Promise<number> {
  return prisma.gymMember.count({ where: newJoinsWhere(reference, [DAY_PASS_TYPE]) });
}

export type MembershipKpiMemberRow = {
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinDate: Date;
  planName: string | null;
  status: string | null;
  paymentStatus: string | null;
};

async function fetchMembersFor(where: Prisma.GymMemberWhereInput): Promise<MembershipKpiMemberRow[]> {
  const members = await prisma.gymMember.findMany({
    where,
    orderBy: { joinDate: "desc" },
    include: { memberships: { orderBy: { startDate: "desc" }, take: 1, include: { plan: true } } },
  });
  return members.map((m) => ({
    memberNumber: m.memberNumber,
    fullName: m.fullName,
    email: m.email,
    phone: m.phone,
    joinDate: m.joinDate,
    planName: m.memberships[0]?.plan.name ?? m.ashbourneMembershipType ?? null,
    status: m.memberships[0]?.status ?? null,
    paymentStatus: m.memberships[0]?.paymentStatus ?? null,
  }));
}

/** The actual members behind the "New Members This Month" KPI — same
 * joinDate+type WHERE as getNewMembershipsThisMonth, so the export always
 * matches the number on the card. */
export async function getNewMembersThisMonthRecords(reference: Date = new Date()): Promise<MembershipKpiMemberRow[]> {
  return fetchMembersFor(newJoinsWhere(reference, ACTIVE_TYPES_ARR));
}

/** The actual members behind the "Day Passes This Month" KPI. */
export async function getDayPassesThisMonthRecords(reference: Date = new Date()): Promise<MembershipKpiMemberRow[]> {
  return fetchMembersFor(newJoinsWhere(reference, [DAY_PASS_TYPE]));
}
