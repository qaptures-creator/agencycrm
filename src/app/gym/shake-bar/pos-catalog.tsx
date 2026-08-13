import { Package, Tag } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { moneyGBP } from "./money";
import type { getGoodtillCatalogView } from "@/lib/gym/integrations/goodtill-analytics";

type CatalogView = Awaited<ReturnType<typeof getGoodtillCatalogView>>;

/** Mirrors the complete SumUp product/category catalog, unfiltered. SumUp
 * is the source of truth here — this never computes or corrects stock, it
 * only displays exactly what the API reports. */
export function PosCatalog({ categories, products }: CatalogView) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? "" : "s"} across {categories.length} categor{categories.length === 1 ? "y" : "ies"} — mirrored
          directly from SumUp POS, no filtering.
        </p>
        {products.length === 0 ? (
          <EmptyState icon={Package} title="No products synced yet" description="Click Sync SumUp above to pull the full product catalog." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Inventory Tracking</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Min Stock</TableHead>
                  <TableHead>Low Stock Alert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const lowStock = p.trackInventory && p.inventory !== null && p.minStock !== null && p.inventory <= p.minStock;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku || "—"}</TableCell>
                      <TableCell>{p.categoryName}</TableCell>
                      <TableCell>{moneyGBP(p.sellingPrice)}</TableCell>
                      <TableCell className="text-muted-foreground">{moneyGBP(p.purchasePrice)}</TableCell>
                      <TableCell>
                        <Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>
                        {p.trackInventory ? <Badge variant="outline">ON</Badge> : <span className="text-xs text-muted-foreground">Off</span>}
                      </TableCell>
                      <TableCell className={lowStock ? "font-semibold text-destructive" : undefined}>
                        {p.trackInventory ? (p.inventory ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.trackInventory ? (p.minStock ?? "—") : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.alertOn ? `Below ${p.alertBelow ?? "—"}` : "Off"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <Tag className="size-4" />
            SumUp Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories synced yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.active ? "success" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
