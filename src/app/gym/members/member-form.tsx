"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { memberSchema, type MemberInput } from "@/lib/gym/validators";
import { createMemberAction, updateMemberAction } from "@/actions/gym/members";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toDateInputValue } from "@/lib/utils";
import type { GymMember } from "@prisma/client";

type MemberFormValues = z.input<typeof memberSchema>;

export function MemberForm({
  member,
  onSuccess,
  onCancel,
}: {
  member?: GymMember;
  onSuccess?: (member: GymMember) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues, unknown, MemberInput>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      fullName: member?.fullName ?? "",
      email: member?.email ?? "",
      phone: member?.phone ?? "",
      dob: toDateInputValue(member?.dob),
      emergencyContactName: member?.emergencyContactName ?? "",
      emergencyContactPhone: member?.emergencyContactPhone ?? "",
      address: member?.address ?? "",
      joinDate: toDateInputValue(member?.joinDate) || toDateInputValue(new Date()),
      notes: member?.notes ?? "",
    },
  });

  async function onSubmit(values: MemberInput) {
    try {
      const result = member ? await updateMemberAction(member.id, values) : await createMemberAction(values);
      toast.success(member ? "Member details updated" : "Member added");
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
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" type="date" {...register("dob")} />
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
          <Label htmlFor="joinDate">Join Date</Label>
          <Input id="joinDate" type="date" {...register("joinDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Input id="address" {...register("address")} />
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
          {isSubmitting ? "Saving…" : member ? "Save changes" : "Add member"}
        </Button>
      </div>
    </form>
  );
}
