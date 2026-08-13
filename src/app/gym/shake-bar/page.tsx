import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShakeBarList } from "./shake-bar-list";
import { PosStatusBar } from "./pos-status-bar";
import { PosAnalytics } from "./pos-analytics";
import { PosCatalog } from "./pos-catalog";
import { PosRecentSales } from "./pos-recent-sales";

export default async function ShakeBarPage({
  searchParams,
}: {
  searchParams: Promise<{ posRange?: string; posFrom?: string; posTo?: string }>;
}) {
  await requireGymUser();

  const { posRange, posFrom, posTo } = await searchParams;
  const range = resolvePosDateRange(posRange, posFrom, posTo);

  const [manualProducts, syncStatus, headerStats, comparisons, rangeStats, topByRevenue, topByUnits, slowest, categoryBreakdown, recentSales, catalog] =
    await Promise.all([
      prisma.gymShakeBarProduct.findMany({ orderBy: [{ name: "asc" }] }),
      getGoodtillSyncStatus(),
      getGoodtillHeaderStats(),
      getGoodtillPeriodComparisons(),
      getGoodtillRangeStats(range),
      getGoodtillTopProductsByRevenue(range, 10),
      getGoodtillTopProductsByUnits(range, 10),
      getGoodtillSlowestProducts(range, 10),
      getGoodtillCategoryBreakdown(range),
      getGoodtillRecentSales(15),
      getGoodtillCatalogView(),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Shake Bar</h1>
          <p className="text-sm text-muted-foreground">Live SumUp POS sales, analytics, product catalog and stock levels.</p>
        </div>
      </div>

      <PosStatusBar status={syncStatus} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">SumUp Products</TabsTrigger>
          <TabsTrigger value="sales">Recent Sales</TabsTrigger>
          <TabsTrigger value="manual">Manual Products</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PosAnalytics
            headerStats={headerStats}
            comparisons={comparisons}
            rangeStats={rangeStats}
            topByRevenue={topByRevenue}
            topByUnits={topByUnits}
            slowest={slowest}
            categories={categoryBreakdown}
            range={range}
            activeRangeParam={posRange ?? "month"}
          />
        </TabsContent>

        <TabsContent value="products">
          <PosCatalog categories={catalog.categories} products={catalog.products} />
        </TabsContent>

        <TabsContent value="sales">
          <PosRecentSales sales={recentSales} />
        </TabsContent>

        <TabsContent value="manual">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Manually-tracked products, separate from the SumUp mirror above. Existing restock/sale/adjustment history is unaffected by the SumUp
              integration.
            </p>
            <ShakeBarList
              products={manualProducts.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                stock: p.stock,
                costPrice: p.costPrice,
                sellingPrice: p.sellingPrice,
                lowStockLevel: p.lowStockLevel,
                supplier: p.supplier,
                lastRestockedAt: p.lastRestockedAt,
              }))}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
