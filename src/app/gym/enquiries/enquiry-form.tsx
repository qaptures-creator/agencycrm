"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { enquirySchema, type EnquiryInput } from "@/lib/gym/validators";
import { createEnquiryAction } from "@/actions/gym/enquiries";
import { ENQUIRY_CATEGORIES, ENQUIRY_SOURCES, TASK_PRIORITIES } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StaffOption = { id: string; fullName: string };

export function EnquiryForm({ staff, onSuccess, onCancel }: { staff: StaffOption[]; onSuccess?: () => void; onCancel?: () => void }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof enquirySchema>, unknown, EnquiryInput>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { name: "", email: "", phone: "", subject: "", category: "GENERAL", priority: "NORMAL", source: "MANUAL", assignedToId: "", message: "" },
  });

  async function onSubmit(values: EnquiryInput) {
    try {
      await createEnquiryAction(values);
      toast.success("Enquiry logged");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" {...register("subject")} />
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
                  {ENQUIRY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
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
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label>Source</Label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENQUIRY_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
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
                    <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" rows={4} {...register("message")} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Log enquiry"}
        </Button>
      </div>
    </form>
  );
}
