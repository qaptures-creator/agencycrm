"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { cleaningTaskSchema, type CleaningTaskInput } from "@/lib/gym/validators";
import { createCleaningTaskAction } from "@/actions/gym/cleaning";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ZoneOption = { id: string; name: string };
type StaffOption = { id: string; fullName: string };

export function CleaningTaskForm({
  dateIso,
  zones,
  staff,
  onSuccess,
  onCancel,
}: {
  dateIso: string;
  zones: ZoneOption[];
  staff: StaffOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof cleaningTaskSchema>, unknown, CleaningTaskInput>({
    resolver: zodResolver(cleaningTaskSchema),
    defaultValues: {
      date: dateIso,
      zoneId: zones[0]?.id ?? "",
      whatBeingCleaned: "",
      assignedToId: "",
      notes: "",
      photoUrl: "",
      status: "PENDING",
    },
  });

  async function onSubmit(values: CleaningTaskInput) {
    try {
      await createCleaningTaskAction(values);
      toast.success("Cleaning task created");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (zones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cleaning zones set up yet. Use &ldquo;Manage Zones&rdquo; to add one first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Zone / Area *</Label>
          <Controller
            control={control}
            name="zoneId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="whatBeingCleaned">What&apos;s being cleaned *</Label>
        <Textarea id="whatBeingCleaned" rows={2} placeholder="e.g. Dumbbells, benches, mats, mirrors…" {...register("whatBeingCleaned")} />
        {errors.whatBeingCleaned && <p className="text-xs text-destructive">{errors.whatBeingCleaned.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Assign To</Label>
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
        <Textarea id="notes" rows={2} placeholder="e.g. Photos received on WhatsApp at 14:20" {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
