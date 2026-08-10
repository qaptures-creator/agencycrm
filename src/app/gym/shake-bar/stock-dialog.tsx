"use client";

import * as React from "react";
import { toast } from "sonner";
import { restockProductAction, recordStockActivityAction } from "@/actions/gym/shake-bar";
import { EntityDialog } from "@/components/entity-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductRow } from "./shake-bar-list";

export function RestockDialog({
  product,
  open,
  onOpenChange,
}: {
  product: ProductRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [quantity, setQuantity] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    setSubmitting(true);
    try {
      await restockProductAction(product.id, qty, note);
      toast.success(`Restocked ${product.name}`);
      setQuantity("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={`Restock — ${product.name}`}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="restockQty">Quantity Received *</Label>
          <Input id="restockQty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="restockNote">Note</Label>
          <Textarea id="restockNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional…" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || !quantity} onClick={submit}>
            {submitting ? "Saving…" : "Add Stock"}
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}

export function StockActivityDialog({
  product,
  open,
  onOpenChange,
}: {
  product: ProductRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = React.useState<"SALE" | "ADJUSTMENT">("SALE");
  const [quantity, setQuantity] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) return;
    setSubmitting(true);
    try {
      await recordStockActivityAction(product.id, type, qty, note);
      toast.success(type === "SALE" ? `Recorded sale for ${product.name}` : `Adjusted stock for ${product.name}`);
      setQuantity("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={`Record Sale / Adjustment — ${product.name}`}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "SALE" | "ADJUSTMENT")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SALE">Sale (decreases stock)</SelectItem>
              <SelectItem value="ADJUSTMENT">Adjustment (set a delta)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activityQty">{type === "SALE" ? "Units Sold *" : "Delta *"}</Label>
          <Input
            id="activityQty"
            type="number"
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={type === "SALE" ? "e.g. 2" : "e.g. -3 or 5"}
          />
          {type === "ADJUSTMENT" && (
            <p className="text-xs text-muted-foreground">Use a negative number to reduce stock, positive to increase it.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activityNote">Note</Label>
          <Textarea id="activityNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional…" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || !quantity} onClick={submit}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}
