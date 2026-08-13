import { TrendingUp, TrendingDown, Minus, Receipt, Wallet, Package, Gauge } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { moneyGBP } from "./money";
import { PosRangeFilter } from "./pos-range-filter";
import { cn, toDateInputValue } from "@/lib/utils";
import type {
  getGoodtillHeaderStats,
  getGoodtillPeriodComparisons,
  getGoodtillCategoryBreakdown,
  getGoodtillRangeStats,
  PosPeriodStats,
  PosProductRanking,
  ResolvedPosRange,
} from "@/lib/gym/integrations/goodtill-analytics";

function formatUnits(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">No prior period data</span>;
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        pct > 0 && "text-success",
        pct < 0 && "text-destructive",
        pct === 0 && "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function PeriodCard({
  title,
  stats,
  trend,
}: {
  title: string;
  stats: PosPeriodStats;
  trend?: { revenueChangePct: number | null; unitsChangePct: number | null };
}) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Sales</p>
          <p className="text-lg font-semibold tabular-nums">{stats.transactions}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="text-lg font-semibold tabular-nums">{moneyGBP(stats.revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Units</p>
          <p className="text-lg font-semibold tabular-nums">{formatUnits(stats.units)}</p>
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5">
          <span className="text-xs text-muted-foreground">
            Revenue vs last: <Trend pct={trend.revenueChangePct} />
          </span>
          <span className="text-xs text-muted-foreground">
            Units vs last: <Trend pct={trend.unitsChangePct} />
          </span>
        </div>
      )}
    </Card>
  );
}

function RankingTable({
  title,
  rows,
  valueLabel,
  formatValue,
}: {
  title: string;
  rows: PosProductRanking[];
  valueLabel: string;
  formatValue: (r: PosProductRanking) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales in this range yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">{valueLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.productExternalId ?? r.productName}-${i}`}>
                  <TableCell className="font-medium">{r.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.sku || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatValue(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

type HeaderStats = Awaited<ReturnType<typeof getGoodtillHeaderStats>>;
type Comparisons = Awaited<ReturnType<typeof getGoodtillPeriodComparisons>>;
type CategoryBreakdown = Awaited<ReturnType<typeof getGoodtillCategoryBreakdown>>;
type RangeStats = Awaited<ReturnType<typeof getGoodtillRangeStats>>;

export function PosAnalytics({
  headerStats,
  comparisons,
  rangeStats,
  topByRevenue,
  topByUnits,
  slowest,
  categories,
  range,
  activeRangeParam,
}: {
  headerStats: HeaderStats;
  comparisons: Comparisons;
  rangeStats: RangeStats;
  topByRevenue: PosProductRanking[];
  topByUnits: PosProductRanking[];
  slowest: PosProductRanking[];
  categories: CategoryBreakdown;
  range: ResolvedPosRange;
  activeRangeParam: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PeriodCard title="Today" stats={headerStats.today} />
        <PeriodCard title="This Week" stats={headerStats.thisWeek} trend={comparisons.week} />
        <PeriodCard title="This Month" stats={headerStats.thisMonth} trend={comparisons.month} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Sales Breakdown</h2>
          <span className="text-xs text-muted-foreground">{range.label}</span>
        </div>
        <PosRangeFilter active={activeRangeParam} from={toDateInputValue(range.from)} to={toDateInputValue(range.to)} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Transactions" value={rangeStats.transactions} icon={Receipt} />
          <StatCard label="Revenue" value={moneyGBP(rangeStats.revenue)} icon={Wallet} tone="success" />
          <StatCard label="Units Sold" value={formatUnits(rangeStats.units)} icon={Package} />
          <StatCard label="Avg Transaction" value={moneyGBP(rangeStats.avgTransactionValue)} icon={Gauge} />
        </div>

        {rangeStats.transactions === 0 ? (
          <EmptyState icon={Receipt} title="No sales in this range" description="Try a wider range, or check back once SumUp sales come through." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RankingTable title="Top 10 Products by Revenue" rows={topByRevenue} valueLabel="Revenue" formatValue={(r) => moneyGBP(r.revenue)} />
              <RankingTable title="Top 10 Products by Units Sold" rows={topByUnits} valueLabel="Units" formatValue={(r) => formatUnits(r.units)} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Sales by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales in this range yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((c) => (
                          <TableRow key={c.categoryExternalId ?? "uncategorized"}>
                            <TableCell className="font-medium">{c.categoryName}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatUnits(c.units)}</TableCell>
                            <TableCell className="text-right tabular-nums">{moneyGBP(c.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <RankingTable title="Slowest-Selling Products" rows={slowest} valueLabel="Units" formatValue={(r) => formatUnits(r.units)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
