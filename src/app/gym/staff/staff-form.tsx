"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { staffSchema, type StaffInput } from "@/lib/gym/validators";
import { createStaffAction, updateStaffAction } from "@/actions/gym/staff";
import { STAFF_POSITIONS, EMPLOYMENT_STATUSES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";
import type { GymStaff } from "@prisma/client";

type StaffFormValues = z.input<typeof staffSchema>;

export function StaffForm({
  staff,
  onSuccess,
  onCancel,
}: {
  staff?: GymStaff;
  onSuccess?: (staff: GymStaff) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues, unknown, StaffInput>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      fullName: staff?.fullName ?? "",
      email: staff?.email ?? "",
      phone: staff?.phone ?? "",
      position: staff?.position ?? "Reception",
      employmentStatus: staff?.employmentStatus ?? "Active",
      startDate: toDateInputValue(staff?.startDate),
      endDate: toDateInputValue(staff?.endDate),
      typicalHours: staff?.typicalHours ?? "",
      emergencyContactName: staff?.emergencyContactName ?? "",
      emergencyContactPhone: staff?.emergencyContactPhone ?? "",
      notes: staff?.notes ?? "",
    },
  });

  async function onSubmit(values: StaffInput) {
    try {
      const result = staff ? await updateStaffAction(staff.id, values) : await createStaffAction(values);
      toast.success(staff ? "Staff profile updated" : "Staff member added");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input id="fullName" {...register("fullName")} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="position">Position *</Label>
          <Controller
            control={control}
            name="position"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
          <Label htmlFor="employmentStatus">Employment Status</Label>
          <Controller
            control={control}
            name="employmentStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="employmentStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="typicalHours">Typical Working Hours</Label>
          <Input id="typicalHours" placeholder="e.g. Mon–Fri, 9am–5pm" {...register("typicalHours")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...register("startDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" {...register("endDate")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
          <Input id="emergencyContactName" {...register("emergencyContactName")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
          <Input id="emergencyContactPhone" {...register("emergencyContactPhone")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : staff ? "Save changes" : "Add staff member"}
        </Button>
      </div>
    </form>
  );
}
