import { NextRequest, NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { parseMemberListFilters, getAllFilteredMembers } from "@/lib/gym/member-filters";
import { toCsv, slugifyForFilename } from "@/lib/gym/csv";
import { formatDate } from "@/lib/utils";

/** Members CSV export — reuses the exact same filter parsing/query logic as
 * the Members page (parseMemberListFilters + the shared buildConditions/
 * MEMBER_JOIN_SQL in member-filters.ts), just unpaginated, so the export
 * can never diverge from what the page itself shows for the same filters. */
export async function GET(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp: Record<string, string | undefined> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    sp[key] = value;
  });
  const filters = parseMemberListFilters(sp);

  const rows = await getAllFilteredMembers(filters);

  const headers = ["Member Number", "Name", "Email", "Phone", "Membership Type", "Join Date", "Status", "Payment Status", "Next Payment", "Last Visit"];
  const csvRows = rows.map((m) => [
    m.memberNumber,
    m.fullName,
    m.email ?? "",
    m.phone ?? "",
    m.membership?.planName ?? "",
    formatDate(m.joinDate),
    m.membership?.status ?? "",
    m.membership?.paymentStatus ?? "",
    m.membership?.renewalDate ? formatDate(m.membership.renewalDate) : "",
    m.lastVisitAt ? formatDate(m.lastVisitAt) : "",
  ]);
  const csv = toCsv(headers, csvRows);

  const today = new Date().toISOString().slice(0, 10);
  const parts = ["members"];
  if (filters.status !== "All") parts.push(slugifyForFilename(filters.status));
  if (filters.type) parts.push(slugifyForFilename(filters.type));
  parts.push(today);
  const filename = `${parts.join("-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
