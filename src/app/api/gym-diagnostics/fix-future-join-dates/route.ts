import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — one-off backfill for members whose joinDate was incorrectly
 * set from a forward-dated Day Pass transaction (see ashbourne-sales-import.ts).
 * Resets joinDate to the member's own createdAt (a real historical fact,
 * unlike "today" which would fabricate a mass "New This Month" spike).
 * GET = dry run (no writes). POST = apply. Deleted right after use. */
export async function GET(req: Request) {
  return handle(req, false);
}

export async function POST(req: Request) {
  return handle(req, true);
}

async function handle(req: Request, apply: boolean) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const now = new Date();
  const affected = await prisma.gymMember.findMany({
    where: { joinDate: { gt: now } },
    select: { id: true, fullName: true, memberNumber: true, joinDate: true, createdAt: true },
  });

  if (!apply) {
    return NextResponse.json({
      dryRun: true,
      affectedCount: affected.length,
      sample: affected.slice(0, 15).map((m) => ({
        member: `${m.fullName} (${m.memberNumber})`,
        currentJoinDate: m.joinDate.toISOString().slice(0, 10),
        wouldBecome: m.createdAt.toISOString().slice(0, 10),
      })),
    });
  }

  let updated = 0;
  for (const m of affected) {
    await prisma.gymMember.update({ where: { id: m.id }, data: { joinDate: m.createdAt } });
    updated++;
  }

  return NextResponse.json({ dryRun: false, affectedCount: affected.length, updated });
}
