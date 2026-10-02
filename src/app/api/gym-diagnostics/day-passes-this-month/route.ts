import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";

/** TEMPORARY — read-only against our own DB (no writes, no Ashbourne/
 * SumUp calls). Answers "how many day passes sold this month via SumUp" by
 * summing GymPosSaleItem quantity for any product whose name contains "day
 * pass", within the current calendar month, excluding voided sales and
 * removed line items. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const items = await prisma.gymPosSaleItem.findMany({
    where: {
      isRemoved: false,
      productName: { contains: "day pass", mode: "insensitive" },
      sale: { saleDateTime: { gte: from, lte: to }, orderStatus: { not: "VOIDED" } },
    },
    select: { productName: true, quantity: true, lineTotalIncVat: true, sale: { select: { saleDateTime: true, orderStatus: true } } },
    orderBy: { sale: { saleDateTime: "desc" } },
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

  // Also check all distinct product names in the whole catalog containing
  // "day" to catch anything not literally named "Day Pass" (e.g. "3 Day
  // Pass", "Day Pass - Guest") that the contains-match might still need
  // eyeballing against.
  const similarProducts = await prisma.gymPosProduct.findMany({
    where: { name: { contains: "day", mode: "insensitive" } },
    select: { name: true, externalId: true },
  });

  return NextResponse.json({
    range: { from, to },
    totalUnits,
    totalRevenue,
    byProduct: Object.fromEntries(byProduct),
    rowCount: items.length,
    similarProductsInCatalog: similarProducts,
  });
}
