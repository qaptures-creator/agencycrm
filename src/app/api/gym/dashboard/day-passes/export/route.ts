import { NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { getDayPassesThisMonthRecords } from "@/lib/gym/membership-kpis";
import { toCsv } from "@/lib/gym/csv";
import { formatDate } from "@/lib/utils";

/** The actual members behind the Dashboard "Day Passes This Month" card. */
export async function GET() {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await getDayPassesThisMonthRecords();
  const headers = ["Member Number", "Name", "Email", "Phone", "Join Date", "Status", "Payment Status"];
  const csv = toCsv(
    headers,
    rows.map((m) => [m.memberNumber, m.fullName, m.email ?? "", m.phone ?? "", formatDate(m.joinDate), m.status ?? "", m.paymentStatus ?? ""])
  );

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="day-passes-this-month-${today}.csv"`,
    },
  });
}
