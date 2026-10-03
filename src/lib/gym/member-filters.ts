import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { startOfMonth } from "date-fns";
import {
  MEMBER_STATUS_TABS,
  MEMBER_SORT_KEYS,
  MEMBER_PAGE_SIZE,
  type MemberStatusTab,
  type MemberSortKey,
  type MemberListFilters,
  type MemberRow,
} from "./member-filters-shared";

export { MEMBER_STATUS_TABS, MEMBER_SORT_KEYS, MEMBER_PAGE_SIZE };
export type { MemberStatusTab, MemberSortKey, MemberListFilters, MemberRow };

/**
 * Server-side Members-list filtering/sorting/pagination — replaces the
 * previous client-side implementation that loaded every member into the
 * browser unfiltered on every page load.
 *
 * Uses a single raw SQL query (via Prisma's tagged-template $queryRaw, not
 * string concatenation — every user-influenced value below goes through a
 * `${}` placeholder, never into raw SQL text) rather than the Prisma Client
 * query builder, because the thing being filtered/sorted ("the member's
 * CURRENT membership" — status, payment status, plan/type, next payment
 * date) is the single latest row of a one-to-many relation (GymMembership),
 * which Prisma's query builder can filter via `some: {...}` but cannot sort
 * by. A LEFT JOIN LATERAL picks each member's most-recently-started
 * membership in the same query as the filter/sort/paginate — one indexed
 * query for the page of rows, one indexed query for the total count, both
 * sharing the exact same WHERE/JOIN builder so results and the count (and
 * later, CSV export) can never drift apart.
 */

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Parses + validates URL search params into filters — every value is
 * checked against a fixed whitelist before it's allowed anywhere near the
 * raw SQL builder below (sort/dir/status especially: these select which
 * hardcoded SQL fragment to use, they never become SQL text themselves). */
export function parseMemberListFilters(sp: RawSearchParams): MemberListFilters {
  const statusRaw = first(sp.status) ?? "All";
  const status = (MEMBER_STATUS_TABS as readonly string[]).includes(statusRaw) ? (statusRaw as MemberStatusTab) : "All";

  const type = first(sp.type)?.trim() || null;
  const q = (first(sp.q) ?? "").trim();

  const sortRaw = first(sp.sort) ?? "joinDate";
  const sort = (MEMBER_SORT_KEYS as readonly string[]).includes(sortRaw) ? (sortRaw as MemberSortKey) : "joinDate";

  const dir = first(sp.dir) === "asc" ? "asc" : "desc";

  const pageRaw = Number(first(sp.page));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return { status, type, q, sort, dir, page, pageSize: MEMBER_PAGE_SIZE };
}

/** Real distinct membership types from the data — never hardcoded. Backed
 * by the new @@index([name]) on GymMembershipPlan. */
export async function getDistinctMembershipTypes(): Promise<string[]> {
  const rows = await prisma.gymMembershipPlan.findMany({ distinct: ["name"], select: { name: true }, orderBy: { name: "asc" } });
  return rows.map((r) => r.name);
}

const SORT_COLUMN_SQL: Record<MemberSortKey, Prisma.Sql> = {
  name: Prisma.sql`m."fullName"`,
  type: Prisma.sql`plan.name`,
  joinDate: Prisma.sql`m."joinDate"`,
  nextPayment: Prisma.sql`cur."renewalDate"`,
  status: Prisma.sql`cur.status`,
  payment: Prisma.sql`cur."paymentStatus"`,
  lastVisit: Prisma.sql`m."lastVisitAt"`,
};

/** Every status/type/search condition as a list of parameterized SQL
 * fragments — shared by the row query and the count query below (and,
 * later, CSV export) so they can never compute a different result set than
 * what's actually shown. */
function buildConditions(filters: Pick<MemberListFilters, "status" | "type" | "q">): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(Prisma.sql`(m."fullName" ILIKE ${like} OR m.email ILIKE ${like} OR m.phone ILIKE ${like} OR m."memberNumber" ILIKE ${like})`);
  }

  switch (filters.status) {
    case "Active":
      conditions.push(Prisma.sql`cur.status = 'ACTIVE'`);
      break;
    case "Cancelled":
      conditions.push(Prisma.sql`cur.status = 'CANCELLED'`);
      break;
    case "Frozen":
      conditions.push(Prisma.sql`cur.status = 'FROZEN'`);
      break;
    case "Expired":
      conditions.push(Prisma.sql`cur.status = 'EXPIRED'`);
      break;
    case "Payment Due":
      conditions.push(Prisma.sql`cur."paymentStatus" = 'OVERDUE'`);
      break;
    case "Failed Payment":
      conditions.push(Prisma.sql`cur."paymentStatus" = 'FAILED'`);
      break;
    case "New This Month":
      conditions.push(Prisma.sql`m."joinDate" >= ${startOfMonth(new Date())}`);
      break;
    case "All":
    default:
      break;
  }

  if (filters.type) {
    conditions.push(Prisma.sql`plan.name = ${filters.type}`);
  }

  return conditions;
}

// "Current" membership = most recently started row for that member, across
// any source — matches the exact semantics the previous client-side
// implementation used (`orderBy: { startDate: "desc" }, take: 1`).
const MEMBER_JOIN_SQL = Prisma.sql`
  FROM "GymMember" m
  LEFT JOIN LATERAL (
    SELECT gm.id, gm.status, gm."paymentStatus", gm."renewalDate", gm."planId"
    FROM "GymMembership" gm
    WHERE gm."memberId" = m.id
    ORDER BY gm."startDate" DESC
    LIMIT 1
  ) cur ON true
  LEFT JOIN "GymMembershipPlan" plan ON plan.id = cur."planId"
`;

type RawRow = {
  id: string;
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinDate: Date;
  lastVisitAt: Date | null;
  membershipId: string | null;
  membershipStatus: string | null;
  paymentStatus: string | null;
  renewalDate: Date | null;
  planName: string | null;
};

export async function getFilteredMembers(filters: MemberListFilters): Promise<{ rows: MemberRow[]; total: number }> {
  const conditions = buildConditions(filters);
  const whereSql = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.sql``;
  const orderBySql = SORT_COLUMN_SQL[filters.sort];
  const dirSql = filters.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        m.id, m."memberNumber", m."fullName", m.email, m.phone, m."joinDate", m."lastVisitAt",
        cur.id AS "membershipId", cur.status AS "membershipStatus", cur."paymentStatus" AS "paymentStatus",
        cur."renewalDate" AS "renewalDate", plan.name AS "planName"
      ${MEMBER_JOIN_SQL}
      ${whereSql}
      ORDER BY ${orderBySql} ${dirSql} NULLS LAST, m.id ASC
      LIMIT ${filters.pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      ${MEMBER_JOIN_SQL}
      ${whereSql}
    `),
  ]);

  return {
    total: Number(countResult[0]?.count ?? 0),
    rows: rows.map((r) => ({
      id: r.id,
      memberNumber: r.memberNumber,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      joinDate: r.joinDate.toISOString(),
      lastVisitAt: r.lastVisitAt?.toISOString() ?? null,
      membership: r.membershipId
        ? {
            planName: r.planName ?? "Unknown",
            status: r.membershipStatus!,
            paymentStatus: r.paymentStatus!,
            renewalDate: r.renewalDate?.toISOString() ?? null,
          }
        : null,
    })),
  };
}
