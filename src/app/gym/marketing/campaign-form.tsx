"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { marketingCampaignSchema, type MarketingCampaignInput } from "@/lib/gym/validators";
import { createMarketingCampaignAction, updateMarketingCampaignAction } from "@/actions/gym/marketing";
import { CAMPAIGN_TYPES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";

export const CAMPAIGN_STATUSES = [
  { value: "ACTIVE", label: "Active", color: "#22c55e" },
  { value: "PAUSED", label: "Paused", color: "#f59e0b" },
  { value: "ENDED", label: "Ended", color: "#64748b" },
];

type CampaignLike = {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
};

export function CampaignForm({
  campaign,
  onSuccess,
  onCancel,
}: {
  campaign?: CampaignLike;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof marketingCampaignSchema>, unknown, MarketingCampaignInput>({
    resolver: zodResolver(marketingCampaignSchema),
    defaultValues: {
      name: campaign?.name ?? "",
      type: campaign?.type ?? "OTHER",
      status: campaign?.status ?? "ACTIVE",
      startDate: toDateInputValue(campaign?.startDate),
      endDate: toDateInputValue(campaign?.endDate),
      notes: campaign?.notes ?? "",
    },
  });

  async function onSubmit(values: MarketingCampaignInput) {
    try {
      if (campaign) {
        await updateMarketingCampaignAction(campaign.id, values);
        toast.success("Campaign updated");
      } else {
        await createMarketingCampaignAction(values);
        toast.success("Campaign created");
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Campaign Name *</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
                  {CAMPAIGN_TYPES.map((t) => (
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
                  {CAMPAIGN_STATUSES.map((s) => (
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
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...register("startDate")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" {...register("endDate")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={2} {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : campaign ? "Save changes" : "Create campaign"}
        </Button>
      </div>
    </form>
  );
}
