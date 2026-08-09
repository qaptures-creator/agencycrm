"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { deliverableSchema, type DeliverableInput } from "@/lib/validators";
import { createDeliverable, updateDeliverable } from "@/actions/deliverables";
import { DELIVERABLE_CONTENT_TYPES, APPROVAL_STATUSES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";
import type { Deliverable, Client, Project, User, DeliverableStatusOption } from "@prisma/client";

type DeliverableFormValues = z.input<typeof deliverableSchema>;

export function DeliverableForm({
  deliverable,
  clients,
  projects,
  users,
  statuses,
  defaultClientId,
  defaultProjectId,
  onSuccess,
  onCancel,
}: {
  deliverable?: Deliverable;
  clients: Client[];
  projects: Project[];
  users: User[];
  statuses: DeliverableStatusOption[];
  defaultClientId?: string;
  defaultProjectId?: string;
  onSuccess?: (deliverable: Deliverable) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DeliverableFormValues, unknown, DeliverableInput>({
    resolver: zodResolver(deliverableSchema),
    defaultValues: {
      clientId: deliverable?.clientId ?? defaultClientId ?? "",
      projectId: deliverable?.projectId ?? defaultProjectId ?? "",
      contentType: deliverable?.contentType ?? "REEL",
      customTypeName: deliverable?.customTypeName ?? "",
      assignedEditorId: deliverable?.assignedEditorId ?? "",
      statusId: deliverable?.statusId ?? statuses[0]?.id ?? "",
      deadline: toDateInputValue(deliverable?.deadline),
      revisionCount: deliverable?.revisionCount ?? 0,
      approvalStatus: deliverable?.approvalStatus ?? "PENDING",
      deliveryLink: deliverable?.deliveryLink ?? "",
      notes: deliverable?.notes ?? "",
    },
  });

  const selectedClientId = watch("clientId");
  const contentType = watch("contentType");
  const clientProjects = projects.filter((p) => p.clientId === selectedClientId);

  async function onSubmit(values: DeliverableInput) {
    try {
      const result = deliverable
        ? await updateDeliverable(deliverable.id, values)
        : await createDeliverable(values);
      toast.success(deliverable ? "Deliverable updated" : "Deliverable created");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="clientId">Client *</Label>
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!!defaultClientId}>
                <SelectTrigger id="clientId">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="projectId">Project</Label>
          <Controller
            control={control}
            name="projectId"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger id="projectId">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="contentType">Content Type</Label>
          <Controller
            control={control}
            name="contentType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_CONTENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        {contentType === "OTHER" && (
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <Label htmlFor="customTypeName">Custom Type Name</Label>
            <Input id="customTypeName" {...register("customTypeName")} placeholder="e.g. Podcast clip" />
          </div>
        )}

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="statusId">Status</Label>
          <Controller
            control={control}
            name="statusId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="statusId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="assignedEditorId">Assigned Editor</Label>
          <Controller
            control={control}
            name="assignedEditorId"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger id="assignedEditorId">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" type="date" {...register("deadline")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="revisionCount">Revision Count</Label>
          <Input id="revisionCount" type="number" min={0} {...register("revisionCount")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="approvalStatus">Approval Status</Label>
          <Controller
            control={control}
            name="approvalStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="approvalStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_STATUSES.map((s) => (
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
          <Label htmlFor="deliveryLink">Delivery Link</Label>
          <Input id="deliveryLink" {...register("deliveryLink")} placeholder="https://drive.google.com/…" />
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
          {isSubmitting ? "Saving…" : deliverable ? "Save changes" : "Create deliverable"}
        </Button>
      </div>
    </form>
  );
}
