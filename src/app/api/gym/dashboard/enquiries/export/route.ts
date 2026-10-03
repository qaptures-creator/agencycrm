import { NextResponse } from "next/server";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { getEnquiriesForExport } from "@/lib/gym/dashboard-data";
import { toCsv } from "@/lib/gym/csv";
import { formatDateTime } from "@/lib/utils";

/** Every enquiry, most recent first — the full set behind the Recent
 * Enquiries card (which only shows the latest few on screen). */
export async function GET() {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await getEnquiriesForExport();
  const headers = ["Name", "Email", "Phone", "Category", "Status", "Assigned To", "Created At"];
  const csv = toCsv(
    headers,
    rows.map((e) => [e.name, e.email ?? "", e.phone ?? "", e.category, e.status, e.assignedTo?.fullName ?? "", formatDateTime(e.createdAt)])
  );

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enquiries-${today}.csv"`,
    },
  });
}
