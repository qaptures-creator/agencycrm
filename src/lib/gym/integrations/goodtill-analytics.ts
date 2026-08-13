import "server-only";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subDays, subWeeks, differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";

/**
 * Read-only analytics computed from our own Postgres mirror of Goodtill
 * sales (GymPosSale/GymPosSaleItem) — no calls to the Goodtill API here.
 * Voided sales (order_status "VOIDED", per the sale.voided webhook event
 * Goodtill documents) are excluded from every figure below; removed line
 * items are excluded from unit/revenue figures the same way.
 */

const NOT_VOIDED = { orderStatus: { not: "VOIDED" } } as const;

export const POS_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "month", label: "This Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "custom", label: "Custom" },
] as const;
export type PosRangePreset = (typeof POS_RANGE_PRESETS)[number]["value"];
export type ResolvedPosRange = { from: Date; to: Date; prevFrom: Date; prevTo: Date; label: string };

export function resolvePosDateRange(preset: string | undefined, customFrom?: string, customTo?: string): ResolvedPosRange {
  const now = new Date();
  let from: Date;
  let to: Date;
  let label: string;

  switch (preset) {
    case "today":
      from = startOfDay(now);
      to = endOfDay(now);
      label = "Today";
      break;
    case "last_7_days":
      from = startOfDay(subDays(now, 6));
      to = endOfDay(now);
      label = "Last 7 Days";
      break;
    case "last_30_days":
      from = startOfDay(subDays(now, 29));
      to = endOfDay(now);
      label = "Last 30 Days";
      break;
    case "custom":
      if (customFrom && customTo) {
        from = startOfDay(new Date(customFrom));
        to = endOfDay(new Date(customTo));
        label = "Custom Range";
      } else {
        from = startOfMonth(now);
        to = endOfMonth(now);
        label = "This Month";
      }
      break;
    case "month":
    default:
      from = startOfMonth(now);
      to = endOfMonth(now);
      label = "This Month";
      break;
  }

  const spanDays = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, spanDays - 1);
  return { from, to, prevFrom, prevTo, label };
}

export type PosPeriodStats = { transactions: number; revenue: number; units: number; avgTransactionValue: number };

export async function getGoodtillRangeStats(range: { from: Date; to: Date }): Promise<PosPeriodStats> {
  return periodStats(range.from, range.to);
}

async function periodStats(from: Date, to: Date): Promise<PosPeriodStats> {
  const [sales, units] = await Promise.all([
    prisma.gymPosSale.aggregate({
      where: { saleDateTime: { gte: from, lte: to }, ...NOT_VOIDED },
      _count: { _all: true },
      _sum: { totalIncVat: true },
    }),
    prisma.gymPosSaleItem.aggregate({
      where: { isRemoved: false, sale: { saleDateTime: { gte: from, lte: to }, ...NOT_VOIDED } },
      _sum: { quantity: true },
    }),
  ]);
  const transactions = sales._count._all;
  const revenue = sales._sum.totalIncVat ?? 0;
  return {
    transactions,
    revenue,
    units: units._sum.quantity ?? 0,
    avgTransactionValue: transactions > 0 ? revenue / transactions : 0,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Fixed "Today / This Week / This Month" header stats, shown regardless of
 * whatever range the user has selected for the detailed analytics below. */
export async function getGoodtillHeaderStats() {
  const now = new Date();
  const [today, thisWeek, thisMonth] = await Promise.all([
    periodStats(startOfDay(now), endOfDay(now)),
    periodStats(startOfWeek(now, { weekStartsOn: 1 }), endOfDay(now)),
    periodStats(startOfMonth(now), endOfDay(now)),
  ]);
  return { today, thisWeek, thisMonth };
}

/** This-week-vs-last-week and this-month-vs-last-month, independent of the
 * interactive range picker. */
export async function getGoodtillPeriodComparisons() {
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [thisWeek, lastWeek, thisMonth, lastMonth] = await Promise.all([
    periodStats(thisWeekStart, endOfDay(now)),
    periodStats(lastWeekStart, lastWeekEnd),
    periodStats(thisMonthStart, endOfDay(now)),
    periodStats(lastMonthStart, lastMonthEnd),
  ]);

  return {
    week: { current: thisWeek, previous: lastWeek, revenueChangePct: pctChange(thisWeek.revenue, lastWeek.revenue), unitsChangePct: pctChange(thisWeek.units, lastWeek.units) },
    month: { current: thisMonth, previous: lastMonth, revenueChangePct: pctChange(thisMonth.revenue, lastMonth.revenue), unitsChangePct: pctChange(thisMonth.units, lastMonth.units) },
  };
}

export type PosProductRanking = { productExternalId: string | null; productName: string; sku: string | null; units: number; revenue: number };

async function rankedProducts(range: { from: Date; to: Date }, sortBy: "revenue" | "units", limit: number): Promise<PosProductRanking[]> {
  const grouped = await prisma.gymPosSaleItem.groupBy({
    by: ["productExternalId", "productName"],
    where: { isRemoved: false, sale: { saleDateTime: { gte: range.from, lte: range.to }, ...NOT_VOIDED } },
    _sum: { quantity: true, lineTotalIncVat: true },
  });

  const sorted = grouped.sort((a, b) => {
    const av = sortBy === "units" ? (a._sum.quantity ?? 0) : (a._sum.lineTotalIncVat ?? 0);
    const bv = sortBy === "units" ? (b._sum.quantity ?? 0) : (b._sum.lineTotalIncVat ?? 0);
    return bv - av;
  });

  const top = sorted.slice(0, limit);
  const productIds = top.map((s) => s.productExternalId).filter((id): id is string => !!id);
  const products = productIds.length
    ? await prisma.gymPosProduct.findMany({ where: { externalId: { in: productIds } }, select: { externalId: true, sku: true } })
    : [];
  const skuById = new Map(products.map((p) => [p.externalId, p.sku]));

  return top.map((s) => ({
    productExternalId: s.productExternalId,
    productName: s.productName,
    sku: s.productExternalId ? (skuById.get(s.productExternalId) ?? null) : null,
    units: s._sum.quantity ?? 0,
    revenue: s._sum.lineTotalIncVat ?? 0,
  }));
}

export async function getGoodtillTopProductsByRevenue(range: { from: Date; to: Date }, limit = 10) {
  return rankedProducts(range, "revenue", limit);
}

export async function getGoodtillTopProductsByUnits(range: { from: Date; to: Date }, limit = 10) {
  return rankedProducts(range, "units", limit);
}

/** Active products with the lowest units sold in the range, including
 * products with zero sales — a genuinely "slow" product should show up
 * even if it never sold at all in the window. */
export async function getGoodtillSlowestProducts(range: { from: Date; to: Date }, limit = 10): Promise<PosProductRanking[]> {
  const [products, sold] = await Promise.all([
    prisma.gymPosProduct.findMany({ where: { active: true }, select: { externalId: true, name: true, sku: true } }),
    prisma.gymPosSaleItem.groupBy({
      by: ["productExternalId"],
      where: { isRemoved: false, productExternalId: { not: null }, sale: { saleDateTime: { gte: range.from, lte: range.to }, ...NOT_VOIDED } },
      _sum: { quantity: true, lineTotalIncVat: true },
    }),
  ]);
  const soldById = new Map(sold.map((s) => [s.productExternalId, s._sum]));

  return products
    .map((p) => ({
      productExternalId: p.externalId,
      productName: p.name,
      sku: p.sku,
      units: soldById.get(p.externalId)?.quantity ?? 0,
      revenue: soldById.get(p.externalId)?.lineTotalIncVat ?? 0,
    }))
    .sort((a, b) => a.units - b.units)
    .slice(0, limit);
}

export type PosCategoryBreakdown = { categoryExternalId: string | null; categoryName: string; units: number; revenue: number };

export async function getGoodtillCategoryBreakdown(range: { from: Date; to: Date }): Promise<PosCategoryBreakdown[]> {
  const items = await prisma.gymPosSaleItem.findMany({
    where: { isRemoved: false, sale: { saleDateTime: { gte: range.from, lte: range.to }, ...NOT_VOIDED } },
    select: { productExternalId: true, quantity: true, lineTotalIncVat: true },
  });
  if (items.length === 0) return [];

  const productIds = [...new Set(items.map((i) => i.productExternalId).filter((id): id is string => !!id))];
  const products = productIds.length
    ? await prisma.gymPosProduct.findMany({ where: { externalId: { in: productIds } }, select: { externalId: true, categoryExternalId: true } })
    : [];
  const categoryByProduct = new Map(products.map((p) => [p.externalId, p.categoryExternalId]));

  const categoryIds = [...new Set(products.map((p) => p.categoryExternalId).filter((id): id is string => !!id))];
  const categories = categoryIds.length
    ? await prisma.gymPosCategory.findMany({ where: { externalId: { in: categoryIds } }, select: { externalId: true, name: true } })
    : [];
  const nameByCategory = new Map(categories.map((c) => [c.externalId, c.name]));

  const totals = new Map<string, { units: number; revenue: number }>();
  for (const item of items) {
    const catId = item.productExternalId ? (categoryByProduct.get(item.productExternalId) ?? null) : null;
    const key = catId ?? "__uncategorized__";
    const t = totals.get(key) ?? { units: 0, revenue: 0 };
    t.units += item.quantity;
    t.revenue += item.lineTotalIncVat ?? 0;
    totals.set(key, t);
  }

  return [...totals.entries()]
    .map(([key, t]) => ({
      categoryExternalId: key === "__uncategorized__" ? null : key,
      categoryName: key === "__uncategorized__" ? "Uncategorized" : (nameByCategory.get(key) ?? "Unknown category"),
      ...t,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getGoodtillRecentSales(limit = 15) {
  const sales = await prisma.gymPosSale.findMany({
    orderBy: { saleDateTime: "desc" },
    take: limit,
    include: { items: { where: { isRemoved: false } } },
  });
  return sales.map((s) => ({
    id: s.id,
    externalId: s.externalId,
    saleDateTime: s.saleDateTime,
    totalIncVat: s.totalIncVat,
    orderStatus: s.orderStatus,
    paymentMethods: s.paymentMethods,
    itemSummary: s.items.map((i) => (i.quantity > 1 ? `${i.productName} x${i.quantity}` : i.productName)).join(", ") || "(no items)",
  }));
}

/** Full mirrored catalog for the Products/Categories section — no filtering. */
export async function getGoodtillCatalogView() {
  const [products, categories] = await Promise.all([
    prisma.gymPosProduct.findMany({ orderBy: { name: "asc" } }),
    prisma.gymPosCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  const nameByCategory = new Map(categories.map((c) => [c.externalId, c.name]));
  return {
    categories,
    products: products.map((p) => ({
      ...p,
      categoryName: p.categoryExternalId ? (nameByCategory.get(p.categoryExternalId) ?? "Unknown category") : "Uncategorized",
    })),
  };
}
