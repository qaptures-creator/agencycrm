"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { shakeBarProductSchema, type ShakeBarProductInput } from "@/lib/gym/validators";
import { createShakeBarProductAction, updateShakeBarProductAction } from "@/actions/gym/shake-bar";
import { SHAKE_BAR_CATEGORIES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductRow } from "./shake-bar-list";

export function ShakeBarForm({
  product,
  onSuccess,
  onCancel,
}: {
  product?: ProductRow;
  onSuccess?: (product: ProductRow) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof shakeBarProductSchema>, unknown, ShakeBarProductInput>({
    resolver: zodResolver(shakeBarProductSchema),
    defaultValues: {
      name: product?.name ?? "",
      category: product?.category ?? "OTHER",
      stock: product?.stock ?? 0,
      costPrice: product?.costPrice ?? undefined,
      sellingPrice: product?.sellingPrice ?? undefined,
      lowStockLevel: product?.lowStockLevel ?? 5,
      supplier: product?.supplier ?? "",
    },
  });

  async function onSubmit(values: ShakeBarProductInput) {
    try {
      const result = product
        ? await updateShakeBarProductAction(product.id, values)
        : await createShakeBarProductAction(values);
      toast.success(product ? "Product updated" : "Product added");
      onSuccess?.(result as unknown as ProductRow);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label>Category</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHAKE_BAR_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {!product && (
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <Label htmlFor="stock">Starting Stock</Label>
            <Input id="stock" type="number" min={0} {...register("stock")} />
          </div>
        )}
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="lowStockLevel">Low Stock Level</Label>
          <Input id="lowStockLevel" type="number" min={0} {...register("lowStockLevel")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="costPrice">Cost Price (£)</Label>
          <Input id="costPrice" type="number" step="0.01" min={0} {...register("costPrice")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="sellingPrice">Selling Price (£)</Label>
          <Input id="sellingPrice" type="number" step="0.01" min={0} {...register("sellingPrice")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="supplier">Supplier</Label>
          <Input id="supplier" {...register("supplier")} />
        </div>
      </div>

      {product && (
        <p className="text-xs text-muted-foreground">
          Stock is changed via the Restock / Record Sale-Adjustment actions, not this form.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : product ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
