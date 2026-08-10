"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { gymSettingsSchema, type GymSettingsInput } from "@/lib/gym/validators";
import { updateGymSettingsAction } from "@/actions/gym/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SettingsLike = {
  gymName: string;
  address: string | null;
  phone: string | null;
  email: string;
  website: string | null;
};

export function GymDetailsForm({ settings, canEdit }: { settings: SettingsLike; canEdit: boolean }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof gymSettingsSchema>, unknown, GymSettingsInput>({
    resolver: zodResolver(gymSettingsSchema),
    defaultValues: {
      gymName: settings.gymName,
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      email: settings.email,
      website: settings.website ?? "",
    },
  });

  async function onSubmit(values: GymSettingsInput) {
    try {
      await updateGymSettingsAction(values);
      toast.success("Gym details updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="gymName">Gym Name *</Label>
        <Input id="gymName" disabled={!canEdit} {...register("gymName")} />
        {errors.gymName && <p className="text-xs text-destructive">{errors.gymName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={2} disabled={!canEdit} {...register("address")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" disabled={!canEdit} {...register("phone")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" disabled={!canEdit} {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" disabled={!canEdit} {...register("website")} />
      </div>

      {canEdit ? (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Only Owner or Manager can edit gym details.</p>
      )}
    </form>
  );
}
