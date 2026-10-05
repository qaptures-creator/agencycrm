import { NextRequest, NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { resolveEntryStatsRange, getDailyMemberEntryStats } from "@/lib/gym/entry-stats";

export async function GET(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const range = resolveEntryStatsRange(sp.get("range") ?? undefined, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const report = await getDailyMemberEntryStats(range);

  return NextResponse.json({ ...report, rangeLabel: range.label, preset: range.preset });
}
