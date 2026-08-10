"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { paymentSchema, type PaymentInput } from "@/lib/gym/validators";
import { createPaymentAction } from "@/actions/gym/payments";
import { PAYMENT_TX_STATUSES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";

// Not in src/lib/gym/constants.ts (off-limits to edit), so kept local to this form.
const PAYMENT_TYPES = [
  { value: "MEMBERSHIP", label: "Membership" },
  { value: "JOINING_FEE", label: "Joining Fee" },
  { value: "DAY_PASS", label: "Day Pass" },
  { value: "OTHER", label: "Other" },
];

type MemberOption = { id: string; fullName: string; memberNumber: string };

export function PaymentForm({
  members,
  defaultMemberId,
  onSuccess,
  onCancel,
}: {
  members: MemberOption[];
  defaultMemberId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof paymentSchema>, unknown, PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      memberId: defaultMemberId ?? "",
      transactionRef: "",
      date: toDateInputValue(new Date()),
      amount: 0,
      type: "MEMBERSHIP",
      status: "PAID",
      provider: "MANUAL",
    },
  });

  async function onSubmit(values: PaymentInput) {
    try {
      await createPaymentAction(values);
      toast.success("Payment recorded");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Member *</Label>
        <Controller
          control={control}
          name="memberId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName} · {m.memberNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.memberId && <p className="text-xs text-destructive">{errors.memberId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (£) *</Label>
          <Input id="amount" type="number" step="0.01" {...register("amount")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TX_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
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
          <Label htmlFor="transactionRef">Transaction Reference</Label>
          <Input id="transactionRef" {...register("transactionRef")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provider">Provider</Label>
          <Input id="provider" {...register("provider")} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Manually-recorded payments only. This does not charge anything or contact any payment processor.
      </p>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
