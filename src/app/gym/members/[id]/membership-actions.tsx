"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Snowflake, XCircle, RefreshCcw, Mail, Phone, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog } from "@/components/entity-dialog";
import { membershipSchema, type MembershipInput } from "@/lib/gym/validators";
import { BILLING_FREQUENCIES } from "@/lib/gym/constants";
import {
  freezeMembershipAction,
  unfreezeMembershipAction,
  cancelMembershipAction,
  changeMembershipAction,
} from "@/actions/gym/members";
import { toDateInputValue } from "@/lib/utils";

type PlanOption = { id: string; name: string; price: number; billingFrequency: string };
type CurrentMembership = { id: string; status: string; planId: string; billingAmount: number; paymentFrequency: string; renewalDate: string | null } | null;

export function MembershipActions({
  memberId,
  memberEmail,
  memberPhone,
  canManage,
  current,
  plans,
}: {
  memberId: string;
  memberEmail: string | null;
  memberPhone: string | null;
  canManage: boolean;
  current: CurrentMembership;
  plans: PlanOption[];
}) {
  const [changeOpen, setChangeOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<unknown>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(successMsg);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <>
            {current?.status === "FROZEN" ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={pending}
                onClick={() => run(() => unfreezeMembershipAction(current.id), "Membership unfrozen")}
              >
                <RefreshCcw className="size-3.5" />
                Unfreeze Membership
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={pending || !current || current.status === "CANCELLED"}
                onClick={() => run(() => freezeMembershipAction(current!.id), "Membership frozen")}
              >
                <Snowflake className="size-3.5" />
                Freeze Membership
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={pending || !current || current.status === "CANCELLED"}
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="size-3.5" />
              Cancel Membership
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setChangeOpen(true)}>
              <Pencil className="size-3.5" />
              {current ? "Change Membership" : "Add Membership"}
            </Button>
          </>
        )}
        {memberEmail && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={`mailto:${memberEmail}`}>
              <Mail className="size-3.5" />
              Email Member
            </a>
          </Button>
        )}
        {memberPhone && (
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={`tel:${memberPhone}`}>
              <Phone className="size-3.5" />
              Call Member
            </a>
          </Button>
        )}
      </div>

      <EntityDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel Membership" className="max-w-sm">
        <CancelMembershipForm
          onConfirm={(notes) => {
            if (!current) return;
            run(() => cancelMembershipAction(current.id, notes), "Membership cancelled");
            setCancelOpen(false);
          }}
          onCancel={() => setCancelOpen(false)}
        />
      </EntityDialog>

      <EntityDialog open={changeOpen} onOpenChange={setChangeOpen} title={current ? "Change Membership" : "Add Membership"}>
        <ChangeMembershipForm
          memberId={memberId}
          current={current}
          plans={plans}
          onSuccess={() => setChangeOpen(false)}
          onCancel={() => setChangeOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}

function CancelMembershipForm({ onConfirm, onCancel }: { onConfirm: (notes: string) => void; onCancel: () => void }) {
  const [notes, setNotes] = React.useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This cancels the membership in this CRM only — it does not contact Ashbourne or any payment provider. Management
        will be notified.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="cancel-notes">Reason (optional)</Label>
        <Textarea id="cancel-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button type="button" variant="destructive" onClick={() => onConfirm(notes)}>
          Confirm Cancellation
        </Button>
      </div>
    </div>
  );
}

function ChangeMembershipForm({
  memberId,
  current,
  plans,
  onSuccess,
  onCancel,
}: {
  memberId: string;
  current: CurrentMembership;
  plans: PlanOption[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof membershipSchema>, unknown, MembershipInput>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      memberId,
      planId: current?.planId ?? plans[0]?.id ?? "",
      billingAmount: current?.billingAmount ?? plans[0]?.price ?? 0,
      paymentFrequency: current?.paymentFrequency ?? plans[0]?.billingFrequency ?? "MONTHLY",
      startDate: toDateInputValue(new Date()),
      renewalDate: toDateInputValue(current?.renewalDate),
      status: "ACTIVE",
      paymentStatus: "CURRENT",
    },
  });

  async function onSubmit(values: MembershipInput) {
    try {
      await changeMembershipAction(values);
      toast.success(current ? "Membership changed" : "Membership added");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (plans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active membership plans exist yet. Create one on the{" "}
        <a href="/gym/memberships" className="text-primary hover:underline">
          Memberships
        </a>{" "}
        page first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Plan *</Label>
        <Controller
          control={control}
          name="planId"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                const plan = plans.find((p) => p.id === v);
                if (plan) {
                  setValue("billingAmount", plan.price);
                  setValue("paymentFrequency", plan.billingFrequency);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.planId && <p className="text-xs text-destructive">{errors.planId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="billingAmount">Billing Amount (£) *</Label>
          <Input id="billingAmount" type="number" step="0.01" {...register("billingAmount")} />
        </div>
        <div className="space-y-1.5">
          <Label>Billing Frequency</Label>
          <Controller
            control={control}
            name="paymentFrequency"
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
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...register("startDate")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="renewalDate">Next Renewal Date</Label>
          <Input id="renewalDate" type="date" {...register("renewalDate")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : current ? "Save membership change" : "Create membership"}
        </Button>
      </div>
    </form>
  );
}
