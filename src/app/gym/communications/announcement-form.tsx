"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { announcementSchema, type AnnouncementInput } from "@/lib/gym/validators";
import { createAnnouncementAction } from "@/actions/gym/announcements";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function AnnouncementForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof announcementSchema>, unknown, AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "", pinned: false },
  });

  async function onSubmit(values: AnnouncementInput) {
    try {
      await createAnnouncementAction(values);
      toast.success("Announcement posted — staff will see it when they next log in");
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

      <div className="space-y-1.5">
        <Label htmlFor="body">Message *</Label>
        <Textarea id="body" rows={4} {...register("body")} />
        {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="pinned"
          render={({ field }) => (
            <Checkbox id="pinned" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
          )}
        />
        <Label htmlFor="pinned" className="font-normal">
          Pin to top of the feed and dashboard banner
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Posting…" : "Post announcement"}
        </Button>
      </div>
    </form>
  );
}
