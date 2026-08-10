"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { leadSchema, type GymLeadInput } from "@/lib/gym/validators";
import { createLeadAction, updateLeadAction } from "@/actions/gym/leads";
import { LEAD_SOURCES, LEAD_STAGES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";

type StaffOption = { id: string; fullName: string };
type LeadLike = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  membershipInterest: string | null;
  assignedToId: string | null;
  stage: string;
  nextFollowUpAt: Date | null;
};

export function LeadForm({
  lead,
  staff,
  defaultStage,
  onSuccess,
  onCancel,
}: {
  lead?: LeadLike;
  staff: StaffOption[];
  defaultStage?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof leadSchema>, unknown, GymLeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead?.name ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      source: lead?.source ?? "OTHER",
      membershipInterest: lead?.membershipInterest ?? "",
      assignedToId: lead?.assignedToId ?? "",
      stage: lead?.stage ?? defaultStage ?? "NEW_LEAD",
      nextFollowUpAt: toDateInputValue(lead?.nextFollowUpAt),
    },
  });

  async function onSubmit(values: GymLeadInput) {
    try {
      if (lead) {
        await updateLeadAction(lead.id, values);
        toast.success("Lead updated");
      } else {
        await createLeadAction(values);
        toast.success("Lead created");
      }
      onSuccess?.();
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
          <Label htmlFor="membershipInterest">Membership Interest</Label>
          <Input id="membershipInterest" {...register("membershipInterest")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label>Source</Label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label>Stage</Label>
          <Controller
            control={control}
            name="stage"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label>Assigned Staff</Label>
          <Controller
            control={control}
            name="assignedToId"
            render={({ field }) => (
              <Select value={field.value || "unassigned"} onValueChange={(v) => field.onChange(v === "unassigned" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="nextFollowUpAt">Next Follow-Up</Label>
          <Input id="nextFollowUpAt" type="date" {...register("nextFollowUpAt")} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : lead ? "Save changes" : "Create lead"}
        </Button>
      </div>
    </form>
  );
}
