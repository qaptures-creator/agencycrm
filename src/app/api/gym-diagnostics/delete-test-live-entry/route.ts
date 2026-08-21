import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — deletes only the exact GymLiveEntryEvent test row created
 * while verifying the live-entry webhook (memberNumber "TEST-000001").
 * The match is hardcoded to that literal string so this can't touch any
 * other record. Deleted right after use. */
export async function POST(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await prisma.gymLiveEntryEvent.deleteMany({
    where: { memberNumber: "TEST-000001" },
  });

  return NextResponse.json({ ok: true, deletedCount: result.count });
}
