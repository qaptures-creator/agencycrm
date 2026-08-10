"use client";

import * as React from "react";
import { Plus, CupSoda, PackagePlus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { Badge } from "@/components/ui/badge";
import { SHAKE_BAR_CATEGORIES } from "@/lib/gym/constants";
import { cn, formatDate } from "@/lib/utils";
import { moneyGBP } from "./money";
import { ShakeBarForm } from "./shake-bar-form";
import { RestockDialog, StockActivityDialog } from "./stock-dialog";

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  stock: number;
  costPrice: number | null;
  sellingPrice: number | null;
  lowStockLevel: number;
  supplier: string | null;
  lastRestockedAt: Date | null;
};

export function ShakeBarList({ products }: { products: ProductRow[] }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductRow | null>(null);
  const [restockTarget, setRestockTarget] = React.useState<ProductRow | null>(null);
  const [activityTarget, setActivityTarget] = React.useState<ProductRow | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(product: ProductRow) {
    setEditing(product);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          Add Product
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState icon={CupSoda} title="No products yet" description="Add your first shake bar product to start tracking stock." />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Last Restocked</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const low = p.stock <= p.lowStockLevel;
                return (
                  <TableRow
                    key={p.id}
                    className={cn("cursor-pointer", low && "bg-destructive/5")}
                    onClick={() => openEdit(p)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <GymStatusBadge list={SHAKE_BAR_CATEGORIES} value={p.category} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(low && "font-semibold text-destructive")}>{p.stock}</span>
                        {low && <Badge variant="destructive">Low Stock</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{moneyGBP(p.costPrice)}</TableCell>
                    <TableCell className="text-muted-foreground">{moneyGBP(p.sellingPrice)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.supplier || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.lastRestockedAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRestockTarget(p)}>
                          <PackagePlus className="size-3.5" />
                          Restock
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActivityTarget(p)}>
                          <Receipt className="size-3.5" />
                          Sale / Adjust
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit Product" : "Add Product"}>
        <ShakeBarForm product={editing ?? undefined} onSuccess={() => setDialogOpen(false)} onCancel={() => setDialogOpen(false)} />
      </EntityDialog>

      {restockTarget && (
        <RestockDialog product={restockTarget} open={!!restockTarget} onOpenChange={(open) => !open && setRestockTarget(null)} />
      )}
      {activityTarget && (
        <StockActivityDialog product={activityTarget} open={!!activityTarget} onOpenChange={(open) => !open && setActivityTarget(null)} />
      )}
    </div>
  );
}
