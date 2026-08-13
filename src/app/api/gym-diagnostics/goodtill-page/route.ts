import { NextResponse } from "next/server";
import { getGoodtillSyncStatus } from "@/lib/gym/integrations/goodtill-sync";
import {
  resolvePosDateRange,
  getGoodtillHeaderStats,
  getGoodtillPeriodComparisons,
  getGoodtillRangeStats,
  getGoodtillTopProductsByRevenue,
  getGoodtillTopProductsByUnits,
  getGoodtillSlowestProducts,
  getGoodtillCategoryBreakdown,
  getGoodtillRecentSales,
  getGoodtillCatalogView,
} from "@/lib/gym/integrations/goodtill-analytics";

/** TEMPORARY — exercises exactly the queries the Shake Bar page runs, to
 * confirm they succeed against real production data without needing a
 * logged-in browser session. Deleted right after use. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const range = resolvePosDateRange("last_30_days");

  try {
    const [syncStatus, headerStats, comparisons, rangeStats, topByRevenue, topByUnits, slowest, categoryBreakdown, recentSales, catalog] =
      await Promise.all([
        getGoodtillSyncStatus(),
        getGoodtillHeaderStats(),
        getGoodtillPeriodComparisons(),
        getGoodtillRangeStats(range),
        getGoodtillTopProductsByRevenue(range, 5),
        getGoodtillTopProductsByUnits(range, 5),
        getGoodtillSlowestProducts(range, 5),
        getGoodtillCategoryBreakdown(range),
        getGoodtillRecentSales(5),
        getGoodtillCatalogView(),
      ]);

    return NextResponse.json({
      ok: true,
      syncStatus,
      headerStats,
      comparisons,
      rangeStats,
      topByRevenue,
      topByUnits,
      slowest,
      categoryBreakdown: categoryBreakdown.slice(0, 5),
      recentSales,
      catalogCounts: { categories: catalog.categories.length, products: catalog.products.length },
      sampleProducts: catalog.products.slice(0, 3),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error", stack: err instanceof Error ? err.stack : undefined }, { status: 500 });
  }
}
