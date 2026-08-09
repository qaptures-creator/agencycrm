"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { projectSchema, type ProjectInput } from "@/lib/validators";
import { createProject, updateProject } from "@/actions/projects";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";
import type { Project, Client, User } from "@prisma/client";

type ProjectFormValues = z.input<typeof projectSchema>;

export function ProjectForm({
  project,
  clients,
  users,
  defaultClientId,
  onSuccess,
  onCancel,
}: {
  project?: Project;
  clients: Client[];
  users: User[];
  defaultClientId?: string;
  onSuccess?: (project: Project) => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues, unknown, ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? "",
      clientId: project?.clientId ?? defaultClientId ?? "",
      shootDate: toDateInputValue(project?.shootDate),
      shootTime: project?.shootTime ?? "",
      shootLocation: project?.shootLocation ?? "",
      projectType: project?.projectType ?? "",
      videographerId: project?.videographerId ?? "",
      photographerId: project?.photographerId ?? "",
      editorId: project?.editorId ?? "",
      status: project?.status ?? "PLANNING",
      deadline: toDateInputValue(project?.deadline),
      internalNotes: project?.internalNotes ?? "",
      clientNotes: project?.clientNotes ?? "",
    },
  });

  async function onSubmit(values: ProjectInput) {
    try {
      const result = project ? await updateProject(project.id, values) : await createProject(values);
      toast.success(project ? "Project updated" : "Project created");
      onSuccess?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="name">Project Name *</Label>
          <Input id="name" {...register("name")} placeholder="Summer Campaign Reel Series" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

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
          <Label htmlFor="projectType">Project Type</Label>
          <Controller
            control={control}
            name="projectType"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="projectType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
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
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" type="date" {...register("deadline")} />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="shootDate">Shoot Date</Label>
          <Input id="shootDate" type="date" {...register("shootDate")} />
        </div>
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="shootTime">Shoot Time</Label>
          <Input id="shootTime" type="time" {...register("shootTime")} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="shootLocation">Shoot Location</Label>
          <Input id="shootLocation" {...register("shootLocation")} placeholder="Studio A, 123 Main St" />
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label htmlFor="videographerId">Videographer</Label>
          <Controller
            control={control}
            name="videographerId"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger id="videographerId">
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
          <Label htmlFor="photographerId">Photographer</Label>
          <Controller
            control={control}
            name="photographerId"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger id="photographerId">
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
          <Label htmlFor="editorId">Editor</Label>
          <Controller
            control={control}
            name="editorId"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger id="editorId">
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

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="internalNotes">Internal Notes</Label>
          <Textarea id="internalNotes" rows={3} {...register("internalNotes")} placeholder="Notes for the team only" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="clientNotes">Client Notes</Label>
          <Textarea id="clientNotes" rows={3} {...register("clientNotes")} placeholder="Notes shared with the client" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
