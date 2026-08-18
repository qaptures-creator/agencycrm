"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { parseAshbourneSalesCsv, importAshbourneSalesReport } from "@/lib/gym/ashbourne-sales-import";

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB — generous for a sales report export

export async function importAshbourneSalesReportAction(csvText: string) {
  const user = await assertPermission("manageMemberships");

  if (new Blob([csvText]).size > MAX_CSV_BYTES) {
    throw new Error("That file is larger than expected for a sales report export (5MB limit).");
  }

  const rows = parseAshbourneSalesCsv(csvText);
  if (rows.length === 0) {
    throw new Error("No sales rows found in that file.");
  }

  const summary = await importAshbourneSalesReport(rows);

  await logAudit({
    userId: user.id,
    action: "ASHBOURNE_SALES_REPORT_IMPORTED",
    entityType: "GymMember",
    metadata: {
      totalRows: summary.totalRows,
      membersCreated: summary.membersCreated,
      membershipsCreated: summary.membershipsCreated,
      paymentsCreated: summary.paymentsCreated,
      rowsSkipped: summary.rowsSkipped,
    },
  });

  revalidatePath("/gym/members");
  revalidatePath("/gym/payments");
  revalidatePath("/gym/reports");
  revalidatePath("/gym");
  return summary;
}
