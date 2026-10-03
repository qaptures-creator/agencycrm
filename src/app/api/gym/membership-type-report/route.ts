import { NextRequest, NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { resolveChartRange, getMembershipTypesOverTime, membershipTypesOverTimeToCsv } from "@/lib/gym/membership-type-report";
import { slugifyForFilename } from "@/lib/gym/csv";

/** Membership Types Over Time — powers both the Dashboard chart (JSON) and
 * its CSV export (?format=csv), from the exact same computed report, so
 * they can never show different numbers for the same range. */
export async function GET(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const range = resolveChartRange(sp.get("range") ?? undefined, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const report = await getMembershipTypesOverTime(range);

  if (sp.get("format") === "csv") {
    const csv = membershipTypesOverTimeToCsv(report);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `membership-types-${slugifyForFilename(range.label)}-${today}.csv`;
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  }

  return NextResponse.json({ ...report, rangeLabel: range.label, preset: range.preset });
}
