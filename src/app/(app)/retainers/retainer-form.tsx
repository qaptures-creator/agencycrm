"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { retainerSchema, type RetainerInput } from "@/lib/validators";
import { upsertRetainer } from "@/actions/retainers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toDateInputValue } from "@/lib/utils";
import type { Retainer } from "@prisma/client";

type RetainerFormValues = z.input<typeof retainerSchema>;

export function RetainerForm({
  clientId,
  retainer,
  onSuccess,
  onCancel,
}: {
  clientId: string;
  retainer?: Retainer | null;
  onSuccess?: (retainer: Retainer) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RetainerFormValues, unknown, RetainerInput>({
    resolver: zodResolver(retainerSchema),
    defaultValues: {
      clientId,
      monthlyRetainer: retainer?.monthlyRetainer ?? undefined,
      shootsIncluded: retainer?.shootsIncluded ?? 0,
      videosIncluded: retainer?.videosIncluded ?? 0,
      photosIncluded: retainer?.photosIncluded ?? 0,
      shootsUsed: retainer?.shootsUsed ?? 0,
      videosUsed: retainer?.videosUsed ?? 0,
      photosUsed: retainer?.photosUsed ?? 0,
      nextShootDate: toDateInputValue(retainer?.nextShootDate),
      nextPaymentDate: toDateInputValue(retainer?.nextPaymentDate),
      renewalDate: toDateInputValue(retainer?.renewalDate),
      servicesIncludedText: retainer?.servicesIncludedText ?? "",
    },
  });

  async function onSubmit(values: RetainerInput) {
    try {
      const result = await upsertRetainer(values);
      toast.success("Retainer saved");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="monthlyRetainer">Monthly Retainer *</Label>
          <Input id="monthlyRetainer" type="number" min={0} {...register("monthlyRetainer")} placeholder="3000" />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="servicesIncludedText">Services Included</Label>
          <Textarea id="servicesIncludedText" rows={2} {...register("servicesIncludedText")} placeholder="2 shoots/mo, 8 reels, editing, strategy call" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shootsIncluded">Shoots Included</Label>
          <Input id="shootsIncluded" type="number" min={0} {...register("shootsIncluded")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shootsUsed">Shoots Used</Label>
          <Input id="shootsUsed" type="number" min={0} {...register("shootsUsed")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="videosIncluded">Videos Included</Label>
          <Input id="videosIncluded" type="number" min={0} {...register("videosIncluded")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="videosUsed">Videos Used</Label>
          <Input id="videosUsed" type="number" min={0} {...register("videosUsed")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="photosIncluded">Photos Included</Label>
          <Input id="photosIncluded" type="number" min={0} {...register("photosIncluded")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="photosUsed">Photos Used</Label>
          <Input id="photosUsed" type="number" min={0} {...register("photosUsed")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="nextShootDate">Next Shoot</Label>
          <Input id="nextShootDate" type="date" {...register("nextShootDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="nextPaymentDate">Next Payment</Label>
          <Input id="nextPaymentDate" type="date" {...register("nextPaymentDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="renewalDate">Renewal Date</Label>
          <Input id="renewalDate" type="date" {...register("renewalDate")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save retainer"}
        </Button>
      </div>
    </form>
  );
}
