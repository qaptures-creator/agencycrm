import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const exclude = req.nextUrl.searchParams.get("exclude");
  const stages = await prisma.pipelineStage.findMany({
    where: exclude ? { id: { not: exclude } } : undefined,
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ stages });
}
