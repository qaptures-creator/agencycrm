import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** TEMPORARY, read-only — checks existing plan names and member numbers
 * before designing the sales-report import, so upsert logic isn't guessing.
 * Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const plans = await prisma.gymMembershipPlan.findMany({ select: { id: true, name: true, source: true, price: true } });
  const memberNumbers = await prisma.gymMember.findMany({ select: { memberNumber: true } });
  const existingAshbournePayments = await prisma.gymPayment.count({ where: { provider: "ASHBOURNE" } });

  return NextResponse.json({
    plans,
    memberNumbers: memberNumbers.map((m) => m.memberNumber),
    existingAshbournePayments,
  });
}
