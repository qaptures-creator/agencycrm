"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { maintenanceTicketSchema, type MaintenanceTicketInput } from "@/lib/gym/validators";
import { createMaintenanceTicketAction } from "@/actions/gym/maintenance";
import { TASK_PRIORITIES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StaffOption = { id: string; fullName: string };
type EquipmentOption = { id: string; name: string };

export function MaintenanceForm({
  staff,
  equipment,
  defaultEquipmentId,
  onSuccess,
  onCancel,
}: {
  staff: StaffOption[];
  equipment: EquipmentOption[];
  defaultEquipmentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof maintenanceTicketSchema>, unknown, MaintenanceTicketInput>({
    resolver: zodResolver(maintenanceTicketSchema),
    defaultValues: {
      issue: "",
      area: "",
      equipmentId: defaultEquipmentId ?? "",
      priority: "NORMAL",
      assignedToId: "",
      photoUrl: "",
    },
  });

  async function onSubmit(values: MaintenanceTicketInput) {
    try {
      await createMaintenanceTicketAction(values);
      toast.success("Maintenance ticket created");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="issue">Issue *</Label>
        <Textarea id="issue" rows={2} {...register("issue")} placeholder="Describe what's wrong…" />
        {errors.issue && <p className="text-xs text-destructive">{errors.issue.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="area">Area</Label>
          <Input id="area" placeholder="e.g. Free weights floor" {...register("area")} />
        </div>
        <div className="space-y-1.5">
          <Label>Equipment</Label>
          <Controller
            control={control}
            name="equipmentId"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not equipment-specific</SelectItem>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
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
          <Label>Priority</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="photoUrl">Photo URL</Label>
        <Input id="photoUrl" placeholder="https://…" {...register("photoUrl")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Create ticket"}
        </Button>
      </div>
    </form>
  );
}
