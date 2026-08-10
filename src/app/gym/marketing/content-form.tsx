"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { marketingContentSchema, type MarketingContentInput } from "@/lib/gym/validators";
import { createMarketingContentAction, updateMarketingContentAction } from "@/actions/gym/marketing";
import { MARKETING_PLATFORMS, MARKETING_CONTENT_STATUSES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";

type StaffOption = { id: string; fullName: string };
type ContentLike = {
  id: string;
  title: string;
  platform: string;
  shootDate: Date | null;
  publishDate: Date | null;
  status: string;
  notes: string | null;
  ownerId?: string | null;
};

export function ContentForm({
  content,
  staff,
  onSuccess,
  onCancel,
}: {
  content?: ContentLike;
  staff: StaffOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof marketingContentSchema>, unknown, MarketingContentInput>({
    resolver: zodResolver(marketingContentSchema),
    defaultValues: {
      title: content?.title ?? "",
      platform: content?.platform ?? "INSTAGRAM",
      shootDate: toDateInputValue(content?.shootDate),
      publishDate: toDateInputValue(content?.publishDate),
      status: content?.status ?? "IDEA",
      notes: content?.notes ?? "",
      ownerId: content?.ownerId ?? "",
    },
  });

  async function onSubmit(values: MarketingContentInput) {
    try {
      if (content) {
        await updateMarketingContentAction(content.id, values);
        toast.success("Content updated");
      } else {
        await createMarketingContentAction(values);
        toast.success("Content added");
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Platform</Label>
          <Controller
            control={control}
            name="platform"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETING_PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
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
                  {MARKETING_CONTENT_STATUSES.map((s) => (
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
          <Label htmlFor="shootDate">Shoot Date</Label>
          <Input id="shootDate" type="date" {...register("shootDate")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="publishDate">Publish Date</Label>
          <Input id="publishDate" type="date" {...register("publishDate")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Owner</Label>
        <Controller
          control={control}
          name="ownerId"
          render={({ field }) => (
            <Select value={field.value || "unassigned"} onValueChange={(v) => field.onChange(v === "unassigned" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
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
          {isSubmitting ? "Saving…" : content ? "Save changes" : "Add content"}
        </Button>
      </div>
    </form>
  );
}
