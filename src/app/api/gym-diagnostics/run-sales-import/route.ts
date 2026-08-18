import { NextResponse } from "next/server";
import { parseAshbourneSalesCsv, importAshbourneSalesReport } from "@/lib/gym/ashbourne-sales-import";

/** TEMPORARY — runs the sales report import directly against production for
 * the initial CSV drop, bypassing the browser upload. Deleted right after use. */
export async function POST(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const csvText = await req.text();
  const rows = parseAshbourneSalesCsv(csvText);
  const summary = await importAshbourneSalesReport(rows);

  return NextResponse.json(summary);
}
