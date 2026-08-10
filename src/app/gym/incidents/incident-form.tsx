"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { incidentSchema, type IncidentInput } from "@/lib/gym/validators";
import { createIncidentAction } from "@/actions/gym/incidents";
import { INCIDENT_CATEGORIES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function nowForDateTimeLocal() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function IncidentForm({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof incidentSchema>, unknown, IncidentInput>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      occurredAt: nowForDateTimeLocal(),
      category: "OTHER",
      location: "",
      description: "",
      actionTaken: "",
      witnesses: "",
      followUpRequired: false,
      followUpNotes: "",
    },
  });

  const followUpRequired = watch("followUpRequired");

  async function onSubmit(values: IncidentInput) {
    try {
      await createIncidentAction(values);
      toast.success("Incident logged");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="occurredAt">Date &amp; Time *</Label>
          <Input id="occurredAt" type="datetime-local" {...register("occurredAt")} />
          {errors.occurredAt && <p className="text-xs text-destructive">{errors.occurredAt.message}</p>}
        </div>
        <div className="space-y-1.5">
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
                  {INCIDENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location">Location</Label>
        <Input id="location" placeholder="e.g. Free weights floor" {...register("location")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description *</Label>
        <Textarea id="description" rows={3} {...register("description")} placeholder="What happened…" />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="actionTaken">Action Taken</Label>
        <Textarea id="actionTaken" rows={2} {...register("actionTaken")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="witnesses">Witnesses</Label>
        <Input id="witnesses" {...register("witnesses")} />
      </div>

      <Controller
        control={control}
        name="followUpRequired"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
            Follow-up required
          </label>
        )}
      />

      {followUpRequired && (
        <div className="space-y-1.5">
          <Label htmlFor="followUpNotes">Follow-Up Notes</Label>
          <Textarea id="followUpNotes" rows={2} {...register("followUpNotes")} />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Log incident"}
        </Button>
      </div>
    </form>
  );
}
