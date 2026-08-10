"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { shiftSchema, type ShiftInput } from "@/lib/gym/validators";
import { createShiftAction, updateShiftAction, deleteShiftAction } from "@/actions/gym/rota";
import { EntityDialog } from "@/components/entity-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ShiftDialogState =
  | { mode: "create"; staffId?: string; date?: string }
  | { mode: "edit"; shift: { id: string; staffId: string; date: string; startTime: string; endTime: string; breakMinutes: number; shiftRole: string | null; notes: string | null } };

export function ShiftDialog({
  open,
  onOpenChange,
  state,
  staff,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ShiftDialogState | null;
  staff: { id: string; fullName: string; position: string }[];
  onDone: () => void;
}) {
  const isEdit = state?.mode === "edit";

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof shiftSchema>, unknown, ShiftInput>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { staffId: "", date: "", startTime: "09:00", endTime: "17:00", breakMinutes: 0, shiftRole: "", notes: "" },
  });

  React.useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      const s = state.shift;
      reset({
        staffId: s.staffId,
        date: s.date.slice(0, 10),
        startTime: new Date(s.startTime).toISOString().slice(11, 16),
        endTime: new Date(s.endTime).toISOString().slice(11, 16),
        breakMinutes: s.breakMinutes,
        shiftRole: s.shiftRole ?? "",
        notes: s.notes ?? "",
      });
    } else {
      reset({ staffId: state.staffId ?? "", date: state.date ?? "", startTime: "09:00", endTime: "17:00", breakMinutes: 0, shiftRole: "", notes: "" });
    }
  }, [state, reset]);

  async function onSubmit(values: ShiftInput) {
    try {
      if (isEdit && state?.mode === "edit") {
        await updateShiftAction(state.shift.id, values);
        toast.success("Shift updated");
      } else {
        await createShiftAction(values);
        toast.success("Shift created");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDelete() {
    if (!(state?.mode === "edit")) return;
    try {
      await deleteShiftAction(state.shift.id);
      toast.success("Shift deleted");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete shift");
    }
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={isEdit ? "Edit Shift" : "Create Shift"} className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Staff Member *</Label>
          <Controller
            control={control}
            name="staffId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName} · {s.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.staffId && <p className="text-xs text-destructive">{errors.staffId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input id="date" type="date" {...register("date")} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="startTime">Start *</Label>
            <Input id="startTime" type="time" {...register("startTime")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endTime">Finish *</Label>
            <Input id="endTime" type="time" {...register("endTime")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="breakMinutes">Break (mins)</Label>
            <Input id="breakMinutes" type="number" min={0} {...register("breakMinutes")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shiftRole">Role Override</Label>
            <Input id="shiftRole" placeholder="e.g. covering Reception" {...register("shiftRole")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} {...register("notes")} />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {isEdit ? (
            <Button type="button" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create shift"}
            </Button>
          </div>
        </div>
      </form>
    </EntityDialog>
  );
}
