"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { equipmentSchema, type EquipmentInput } from "@/lib/gym/validators";
import { createEquipmentAction, updateEquipmentAction } from "@/actions/gym/equipment";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";

export type EquipmentRow = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  category: string;
  serialNumber: string | null;
  purchaseDate: Date | null;
  condition: string;
  lastServiceDate: Date | null;
  nextServiceDate: Date | null;
  location: string | null;
  notes: string | null;
  photoUrl: string | null;
};

export function EquipmentForm({
  equipment,
  onSuccess,
  onCancel,
}: {
  equipment?: EquipmentRow;
  onSuccess?: (equipment: EquipmentRow) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof equipmentSchema>, unknown, EquipmentInput>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: equipment?.name ?? "",
      manufacturer: equipment?.manufacturer ?? "",
      model: equipment?.model ?? "",
      category: equipment?.category ?? "OTHER",
      serialNumber: equipment?.serialNumber ?? "",
      purchaseDate: toDateInputValue(equipment?.purchaseDate),
      condition: equipment?.condition ?? "GOOD",
      lastServiceDate: toDateInputValue(equipment?.lastServiceDate),
      nextServiceDate: toDateInputValue(equipment?.nextServiceDate),
      location: equipment?.location ?? "",
      notes: equipment?.notes ?? "",
      photoUrl: equipment?.photoUrl ?? "",
    },
  });

  async function onSubmit(values: EquipmentInput) {
    try {
      const result = equipment
        ? await updateEquipmentAction(equipment.id, values)
        : await createEquipmentAction(values);
      toast.success(equipment ? "Equipment updated" : "Equipment added");
      onSuccess?.(result);
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
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input id="manufacturer" {...register("manufacturer")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="model">Model</Label>
          <Input id="model" {...register("model")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="serialNumber">Serial Number</Label>
          <Input id="serialNumber" {...register("serialNumber")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" placeholder="e.g. Free weights floor" {...register("location")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label>Condition</Label>
          <Controller
            control={control}
            name="condition"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="purchaseDate">Purchase Date</Label>
          <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="lastServiceDate">Last Service Date</Label>
          <Input id="lastServiceDate" type="date" {...register("lastServiceDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="nextServiceDate">Next Service Date</Label>
          <Input id="nextServiceDate" type="date" {...register("nextServiceDate")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="photoUrl">Photo URL</Label>
          <Input id="photoUrl" placeholder="https://…" {...register("photoUrl")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : equipment ? "Save changes" : "Add equipment"}
        </Button>
      </div>
    </form>
  );
}
