"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { leadSchema, type LeadInput } from "@/lib/validators";

type LeadFormValues = z.input<typeof leadSchema>;
import { createLead, updateLead } from "@/actions/leads";
import { LEAD_SOURCES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServicesSelect, type ServiceOption } from "@/components/services-select";
import { toDateInputValue } from "@/lib/utils";
import type { Lead, PipelineStage, User } from "@prisma/client";

type LeadWithRelations = Lead & { services: ServiceOption[] };

export function LeadForm({
  lead,
  stages,
  users,
  services,
  defaultStageId,
  onSuccess,
  onCancel,
}: {
  lead?: LeadWithRelations;
  stages: PipelineStage[];
  users: User[];
  services: ServiceOption[];
  defaultStageId?: string;
  onSuccess?: (lead: Lead) => void;
  onCancel?: () => void;
}) {
  const [serviceOptions, setServiceOptions] = React.useState(services);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues, unknown, LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      companyName: lead?.companyName ?? "",
      contactName: lead?.contactName ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      instagram: lead?.instagram ?? "",
      website: lead?.website ?? "",
      industry: lead?.industry ?? "",
      location: lead?.location ?? "",
      source: lead?.source ?? "",
      estimatedValue: lead?.estimatedValue ?? undefined,
      notes: lead?.notes ?? "",
      lastContactedAt: toDateInputValue(lead?.lastContactedAt),
      nextFollowUpAt: toDateInputValue(lead?.nextFollowUpAt),
      assignedToId: lead?.assignedToId ?? "",
      stageId: lead?.stageId ?? defaultStageId ?? stages[0]?.id ?? "",
      serviceIds: lead?.services?.map((s) => s.id) ?? [],
    },
  });

  async function onSubmit(values: LeadInput) {
    try {
      const result = lead ? await updateLead(lead.id, values) : await createLead(values);
      toast.success(lead ? "Lead updated" : "Lead created");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="companyName">Company / Brand *</Label>
          <Input id="companyName" {...register("companyName")} placeholder="Acme Studios" />
          {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="contactName">Contact Name *</Label>
          <Input id="contactName" {...register("contactName")} placeholder="Jane Doe" />
          {errors.contactName && <p className="text-xs text-destructive">{errors.contactName.message}</p>}
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} placeholder="jane@acme.com" />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} placeholder="+1 555 000 0000" />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="instagram">Instagram / Social</Label>
          <Input id="instagram" {...register("instagram")} placeholder="@acmestudios" />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="website">Website</Label>
          <Input id="website" {...register("website")} placeholder="acme.com" />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" {...register("industry")} placeholder="Hospitality" />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...register("location")} placeholder="Austin, TX" />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="source">Lead Source</Label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="estimatedValue">Estimated Deal Value</Label>
          <Input id="estimatedValue" type="number" min={0} step="1" {...register("estimatedValue")} placeholder="5000" />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="stageId">Stage</Label>
          <Controller
            control={control}
            name="stageId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="stageId">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="assignedToId">Assigned Team Member</Label>
          <Controller
            control={control}
            name="assignedToId"
            render={({ field }) => (
              <Select value={field.value || "unassigned"} onValueChange={(v) => field.onChange(v === "unassigned" ? "" : v)}>
                <SelectTrigger id="assignedToId">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="lastContactedAt">Last Contacted</Label>
          <Input id="lastContactedAt" type="date" {...register("lastContactedAt")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="nextFollowUpAt">Next Follow-up</Label>
          <Input id="nextFollowUpAt" type="date" {...register("nextFollowUpAt")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Services Interested</Label>
          <Controller
            control={control}
            name="serviceIds"
            render={({ field }) => (
              <ServicesSelect
                services={serviceOptions}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
                onServiceCreated={(s) => setServiceOptions((prev) => [...prev, s])}
              />
            )}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={4} {...register("notes")} placeholder="Context, preferences, budget notes…" />
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
