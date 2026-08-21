import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — read-only. Verifies exactly how many of this month's joins
 * are Presale Membership, plus a fresh full breakdown, to confirm the
 * earlier claim against current live data rather than a stale snapshot.
 * No writes. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const presaleJoinsThisMonth = await prisma.gymMember.count({
    where: {
      joinDate: { gte: monthStart, lte: monthEnd },
      memberships: { some: { plan: { name: "Presale Membership" } } },
    },
  });

  const membersThisMonth = await prisma.gymMember.findMany({
    where: { joinDate: { gte: monthStart, lte: monthEnd } },
    select: { memberships: { select: { plan: { select: { name: true } } }, take: 1 } },
  });

  const byPlan = new Map<string, number>();
  for (const m of membersThisMonth) {
    const name = m.memberships[0]?.plan.name ?? "(no membership)";
    byPlan.set(name, (byPlan.get(name) ?? 0) + 1);
  }

  return NextResponse.json({
    presaleJoinsThisMonth,
    totalMembersThisMonth: membersThisMonth.length,
    thisMonthJoinsByPlan: Array.from(byPlan.entries()).map(([name, count]) => ({ name, count })),
    databaseChanged: false,
  });
}
