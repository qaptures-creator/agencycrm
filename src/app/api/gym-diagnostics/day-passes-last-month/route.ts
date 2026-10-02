import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — read-only against our own DB (no writes, no Ashbourne/
 * SumUp calls). Same as day-passes-this-month but for the previous
 * calendar month. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const lastMonth = subMonths(new Date(), 1);
  const from = startOfMonth(lastMonth);
  const to = endOfMonth(lastMonth);

  const items = await prisma.gymPosSaleItem.findMany({
    where: {
      isRemoved: false,
      productName: { contains: "day pass", mode: "insensitive" },
      sale: { saleDateTime: { gte: from, lte: to }, orderStatus: { not: "VOIDED" } },
    },
    select: { productName: true, quantity: true, lineTotalIncVat: true },
  });

  const byProduct = new Map<string, { units: number; revenue: number }>();
  for (const item of items) {
    const t = byProduct.get(item.productName) ?? { units: 0, revenue: 0 };
    t.units += item.quantity;
    t.revenue += item.lineTotalIncVat ?? 0;
    byProduct.set(item.productName, t);
  }

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalRevenue = items.reduce((sum, i) => sum + (i.lineTotalIncVat ?? 0), 0);

  const syncState = await prisma.gymPosSyncState.findUnique({ where: { key: "goodtill" } });

  return NextResponse.json({
    range: { from, to },
    totalUnits,
    totalRevenue,
    byProduct: Object.fromEntries(byProduct),
    rowCount: items.length,
    syncState,
  });
}
