import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const total = await prisma.gymMember.count();
  const byStatus = await prisma.gymMember.groupBy({ by: ["geocodeStatus"], _count: { _all: true } });
  const withAddress = await prisma.gymMember.count({ where: { address: { not: null } } });
  const gymSettings = await prisma.gymSettings.findUnique({ where: { id: "singleton" } });

  return NextResponse.json({ total, withAddress, byStatus, gymSettings });
}
