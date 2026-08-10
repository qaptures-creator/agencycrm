"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { membershipPlanSchema, type MembershipPlanInput } from "@/lib/gym/validators";
import { createPlanAction, updatePlanAction } from "@/actions/gym/memberships";
import { BILLING_FREQUENCIES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GymMembershipPlan } from "@prisma/client";

type PlanFormValues = z.input<typeof membershipPlanSchema>;

type PlanLike = {
  id: string;
  name: string;
  price: number;
  billingFrequency: string;
  joiningFee: number | null;
  contractLengthMonths: number | null;
  description: string | null;
};

export function PlanForm({
  plan,
  onSuccess,
  onCancel,
}: {
  plan?: PlanLike;
  onSuccess?: (plan: GymMembershipPlan) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues, unknown, MembershipPlanInput>({
    resolver: zodResolver(membershipPlanSchema),
    defaultValues: {
      name: plan?.name ?? "",
      price: plan?.price ?? 0,
      billingFrequency: plan?.billingFrequency ?? "MONTHLY",
      joiningFee: plan?.joiningFee ?? undefined,
      contractLengthMonths: plan?.contractLengthMonths ?? undefined,
      description: plan?.description ?? "",
    },
  });

  async function onSubmit(values: MembershipPlanInput) {
    try {
      const result = plan ? await updatePlanAction(plan.id, values) : await createPlanAction(values);
      toast.success(plan ? "Plan updated" : "Plan created");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Plan Name *</Label>
        <Input id="name" placeholder="e.g. Full Member" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (£) *</Label>
          <Input id="price" type="number" step="0.01" {...register("price")} />
        </div>
        <div className="space-y-1.5">
          <Label>Billing Frequency</Label>
          <Controller
            control={control}
            name="billingFrequency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="joiningFee">Joining Fee (£)</Label>
          <Input id="joiningFee" type="number" step="0.01" {...register("joiningFee")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contractLengthMonths">Contract Length (months)</Label>
          <Input id="contractLengthMonths" type="number" {...register("contractLengthMonths")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : plan ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </form>
  );
}
