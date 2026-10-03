import { NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { getCancellationsThisMonthRecords } from "@/lib/gym/dashboard-data";
import { toCsv } from "@/lib/gym/csv";
import { formatDate } from "@/lib/utils";

/** The actual memberships behind the Dashboard "Cancellations" card.
 * Manually-recorded only — Ashbourne's export has no cancellation signal,
 * so every row here was set by staff in the CRM, never by a sync. */
export async function GET() {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await getCancellationsThisMonthRecords();
  const headers = ["Member Number", "Name", "Email", "Phone", "Membership Type", "Cancelled Date"];
  const csv = toCsv(
    headers,
    rows.map((r) => [r.memberNumber, r.fullName, r.email ?? "", r.phone ?? "", r.planName, r.cancelledAt ? formatDate(r.cancelledAt) : ""])
  );

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cancellations-this-month-manually-recorded-${today}.csv"`,
    },
  });
}
