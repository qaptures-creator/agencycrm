import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { DAY_PASS_TYPE } from "./membership-rules";
import {
  RDP_CONVERSION_FILTERS,
  RDP_COUNT_FILTERS,
  RDP_SORT_KEYS,
  RDP_PAGE_SIZE,
  type RdpConversionFilter,
  type RdpCountFilter,
  type RdpSortKey,
  type RdpFilters,
  type RdpRow,
  type RdpSummary,
} from "./returning-day-pass-shared";

export { RDP_CONVERSION_FILTERS, RDP_COUNT_FILTERS, RDP_SORT_KEYS, RDP_PAGE_SIZE };
export type { RdpConversionFilter, RdpCountFilter, RdpSortKey, RdpFilters, RdpRow, RdpSummary };

/**
 * "Returning Day Pass" customers — people who hold MORE THAN ONE separate
 * Day Pass GymMembership record, and whether they've since taken out any
 * other (non-Day-Pass) membership.
 *
 * WHY THIS ISN'T A SIMPLE "GROUP BY memberId" QUERY (investigated before
 * writing any of this):
 *
 * Every path that creates a GymMember from an Ashbourne record — the live
 * BI sync (src/lib/ashbourne/sync.ts) AND the legacy manual sales-report
 * importer (src/lib/gym/ashbourne-sales-import.ts) — matches/creates on
 * Ashbourne's own per-enrollment identifier (ashbourneMemberNo / the sales
 * row's InternalID), never on email or phone. A Day Pass is typically a
 * one-off walk-in sale, not a persistent membership account, so the same
 * real person buying a second Day Pass on a different day very often gets
 * issued a brand-new Ashbourne member number — which lands here as a
 * SEPARATE GymMember row, not a second GymMembership under the same member.
 * (The sync code even has its own same-run duplicate-email detector —
 * `claimedEmails` in sync.ts — that deliberately flags rather than
 * auto-merges, confirming this is a known, accepted characteristic of the
 * source data, not an edge case.) So the one-to-many GymMember ->
 * GymMembership relation on its own under-counts repeat Day Pass customers;
 * cross-member identity resolution (email, then phone, then name) is
 * genuinely required here, exactly as the manual Ashbourne-export process
 * already assumed.
 *
 * Data-completeness note found during investigation: the legacy sales
 * importer sets ONLY fullName/memberNumber/joinDate on member creation —
 * no email, no phone at all — so records that only ever came through that
 * path can only be matched by normalised name. The live sync does populate
 * email/phone when Ashbourne's own export has them, so most current/recent
 * Day Pass records should match on email or phone.
 *
 * LAST ACTIVITY: GymMember.lastVisitAt is never written anywhere in this
 * codebase (confirmed by inspection — no sync, import or live-entry path
 * assigns it), so it's not a reliable activity signal in practice; it's
 * still included in the GREATEST() below in case that changes later, but
 * the real signal today is the latest membership-record timestamp we have
 * (startDate or updatedAt) for that identity. GymLiveEntryEvent (actual
 * gate-swipe log) was considered and deliberately NOT joined in — it only
 * covers the period since the Live Entry integration went live, which
 * would make "Last Activity" look misleadingly recent-only for a report
 * that's inherently about historical Day Pass patterns; membership-record
 * dates cover the full history consistently.
 */

const MEMBERSHIP_ROWS_CTE = Prisma.sql`
  membership_rows AS (
    SELECT
      gm.id AS membership_id,
      gm."memberId" AS member_id,
      gm.status,
      gm."startDate" AS start_date,
      gm."updatedAt" AS membership_updated_at,
      plan.name AS plan_name,
      (plan.name = ${DAY_PASS_TYPE}) AS is_day_pass,
      m.email,
      m.phone,
      TRIM(m."fullName") AS full_name,
      m."lastVisitAt" AS last_visit_at,
      COALESCE(
        NULLIF(LOWER(TRIM(m.email)), ''),
        CASE
          WHEN NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
          THEN 'phone:' || RIGHT(regexp_replace(m.phone, '[^0-9]', '', 'g'), 10)
        END,
        'name:' || LOWER(regexp_replace(TRIM(m."fullName"), '\\s+', ' ', 'g'))
      ) AS identity_key
    FROM "GymMembership" gm
    JOIN "GymMember" m ON m.id = gm."memberId"
    JOIN "GymMembershipPlan" plan ON plan.id = gm."planId"
  )
`;

const IDENTITY_SUMMARY_CTE = Prisma.sql`
  identity_summary AS (
    SELECT
      identity_key,
      COUNT(*) FILTER (WHERE is_day_pass)::int AS day_pass_count,
      COUNT(*) FILTER (WHERE NOT is_day_pass)::int AS other_count,
      MIN(start_date) FILTER (WHERE is_day_pass) AS first_day_pass,
      GREATEST(MAX(start_date), MAX(membership_updated_at), MAX(last_visit_at)) AS last_activity
    FROM membership_rows
    GROUP BY identity_key
  )
`;

const PROFILE_RANKED_CTE = Prisma.sql`
  profile_ranked AS (
    SELECT DISTINCT ON (identity_key)
      identity_key, full_name, email, phone
    FROM membership_rows
    ORDER BY identity_key, GREATEST(start_date, membership_updated_at, COALESCE(last_visit_at, '-infinity'::timestamp)) DESC
  )
`;

const OTHER_RANKED_CTE = Prisma.sql`
  other_ranked AS (
    SELECT DISTINCT ON (identity_key)
      identity_key, plan_name AS other_plan_name, status AS other_status, start_date AS other_start_date
    FROM membership_rows
    WHERE NOT is_day_pass
    ORDER BY identity_key, start_date DESC
  )
`;

/** Returning-day-pass-customer base — everything with day_pass_count >= 2,
 * profile fields and "current/latest other membership" attached. Shared by
 * the paginated list query and the count query below so they can never
 * compute a different population. */
const RETURNING_BASE_SQL = Prisma.sql`
  WITH ${MEMBERSHIP_ROWS_CTE},
  ${IDENTITY_SUMMARY_CTE},
  ${PROFILE_RANKED_CTE},
  ${OTHER_RANKED_CTE}
  SELECT
    s.identity_key,
    p.full_name, p.email, p.phone,
    s.day_pass_count, s.first_day_pass, s.last_activity,
    (s.other_count > 0) AS converted,
    o.other_plan_name, o.other_status, o.other_start_date
  FROM identity_summary s
  JOIN profile_ranked p ON p.identity_key = s.identity_key
  LEFT JOIN other_ranked o ON o.identity_key = s.identity_key
  WHERE s.day_pass_count >= 2
`;

function buildExtraConditions(filters: Pick<RdpFilters, "conversion" | "minCount" | "status" | "q">): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.conversion === "Converted") conditions.push(Prisma.sql`s.other_count > 0`);
  if (filters.conversion === "Not Converted") conditions.push(Prisma.sql`s.other_count = 0`);

  if (filters.minCount !== "All") {
    conditions.push(Prisma.sql`s.day_pass_count >= ${Number(filters.minCount)}`);
  }

  if (filters.status) {
    conditions.push(Prisma.sql`o.other_status = ${filters.status}`);
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(Prisma.sql`(p.full_name ILIKE ${like} OR p.email ILIKE ${like} OR p.phone ILIKE ${like})`);
  }

  return conditions;
}

const SORT_COLUMN_SQL: Record<RdpSortKey, Prisma.Sql> = {
  dayPassCount: Prisma.sql`s.day_pass_count`,
  name: Prisma.sql`p.full_name`,
  firstDayPass: Prisma.sql`s.first_day_pass`,
  lastActivity: Prisma.sql`s.last_activity`,
  membershipStartDate: Prisma.sql`o.other_start_date`,
};

type RawSearchParams = Record<string, string | string[] | undefined>;
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseRdpFilters(sp: RawSearchParams): RdpFilters {
  const conversionRaw = first(sp.rdpConversion) ?? "All";
  const conversion = (RDP_CONVERSION_FILTERS as readonly string[]).includes(conversionRaw) ? (conversionRaw as RdpConversionFilter) : "All";

  const minCountRaw = first(sp.rdpCount) ?? "All";
  const minCount = (RDP_COUNT_FILTERS as readonly string[]).includes(minCountRaw) ? (minCountRaw as RdpCountFilter) : "All";

  const statusRaw = first(sp.rdpStatus)?.trim() || null;
  const status = statusRaw && ["ACTIVE", "FROZEN", "CANCELLED", "EXPIRED", "OVERDUE"].includes(statusRaw) ? statusRaw : null;

  const q = (first(sp.rdpQ) ?? "").trim();

  const sortRaw = first(sp.rdpSort) ?? "dayPassCount";
  const sort = (RDP_SORT_KEYS as readonly string[]).includes(sortRaw) ? (sortRaw as RdpSortKey) : "dayPassCount";

  const dir = first(sp.rdpDir) === "asc" ? "asc" : "desc";

  const pageRaw = Number(first(sp.rdpPage));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return { conversion, minCount, status, q, sort, dir, page, pageSize: RDP_PAGE_SIZE };
}

type RawRow = {
  identity_key: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  day_pass_count: number;
  first_day_pass: Date;
  last_activity: Date | null;
  converted: boolean;
  other_plan_name: string | null;
  other_status: string | null;
  other_start_date: Date | null;
};

function mapRow(r: RawRow): RdpRow {
  return {
    identityKey: r.identity_key,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    dayPassCount: r.day_pass_count,
    converted: r.converted,
    otherPlanName: r.other_plan_name,
    otherStatus: r.other_status,
    otherStartDate: r.other_start_date?.toISOString() ?? null,
    firstDayPass: r.first_day_pass.toISOString(),
    lastActivity: r.last_activity?.toISOString() ?? null,
  };
}

export async function getReturningDayPassList(filters: RdpFilters): Promise<{ rows: RdpRow[]; total: number }> {
  const conditions = buildExtraConditions(filters);
  const extraWhereSql = conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.sql``;
  const orderBySql = SORT_COLUMN_SQL[filters.sort];
  const dirSql = filters.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      ${RETURNING_BASE_SQL}
      ${extraWhereSql}
      ORDER BY ${orderBySql} ${dirSql} NULLS LAST, s.identity_key ASC
      LIMIT ${filters.pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM (
        ${RETURNING_BASE_SQL}
        ${extraWhereSql}
      ) t
    `),
  ]);

  return { total: Number(countResult[0]?.count ?? 0), rows: rows.map(mapRow) };
}

/** Same filtering logic as getReturningDayPassList, without pagination — for
 * CSV export (mirrors getAllFilteredMembers in member-filters.ts). */
export async function getAllReturningDayPass(filters: Omit<RdpFilters, "page" | "pageSize">): Promise<RdpRow[]> {
  const conditions = buildExtraConditions(filters);
  const extraWhereSql = conditions.length > 0 ? Prisma.sql`AND ${Prisma.join(conditions, " AND ")}` : Prisma.sql``;
  const orderBySql = SORT_COLUMN_SQL[filters.sort];
  const dirSql = filters.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    ${RETURNING_BASE_SQL}
    ${extraWhereSql}
    ORDER BY ${orderBySql} ${dirSql} NULLS LAST, s.identity_key ASC
  `);

  return rows.map(mapRow);
}

/** Global (unfiltered-by-the-table-filters) KPI summary for the cards at the
 * top of the page — always the true totals, independent of whatever filter
 * is currently applied to the table below. Cheaper than the list query:
 * no profile/other-membership joins needed. */
export async function getReturningDayPassSummary(): Promise<RdpSummary> {
  const result = await prisma.$queryRaw<Array<{ returning: bigint; converted: bigint; total_day_passes: bigint }>>(Prisma.sql`
    WITH ${MEMBERSHIP_ROWS_CTE},
    ${IDENTITY_SUMMARY_CTE}
    SELECT
      COUNT(*)::bigint AS returning,
      COUNT(*) FILTER (WHERE other_count > 0)::bigint AS converted,
      COALESCE(SUM(day_pass_count), 0)::bigint AS total_day_passes
    FROM identity_summary
    WHERE day_pass_count >= 2
  `);

  const row = result[0] ?? { returning: BigInt(0), converted: BigInt(0), total_day_passes: BigInt(0) };
  const returningCustomers = Number(row.returning);
  const converted = Number(row.converted);
  const notConverted = returningCustomers - converted;
  const conversionRatePct = returningCustomers > 0 ? (converted / returningCustomers) * 100 : 0;

  return {
    returningCustomers,
    converted,
    notConverted,
    conversionRatePct,
    totalDayPassPurchases: Number(row.total_day_passes),
  };
}
