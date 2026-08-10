"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { taskSchema, type TaskInput } from "@/lib/gym/validators";
import { createTaskAction, updateTaskAction } from "@/actions/gym/task-crud";
import { TASK_PRIORITIES, TASK_CATEGORIES, TASK_RECURRENCE, WEEKDAYS } from "@/lib/gym/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateInputValue } from "@/lib/utils";

type StaffOption = { id: string; fullName: string };
type TaskLike = {
  id: string;
  title: string;
  description: string | null;
  assignedToId: string | null;
  dueDate: Date | null;
  dueTime: string | null;
  priority: string;
  category: string;
  recurrence: string;
  recurrenceDay: string | null;
};

export function TaskForm({
  task,
  staff,
  defaultAssignedToId,
  onSuccess,
  onCancel,
}: {
  task?: TaskLike;
  staff: StaffOption[];
  defaultAssignedToId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof taskSchema>, unknown, TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      assignedToId: task?.assignedToId ?? defaultAssignedToId ?? "",
      dueDate: toDateInputValue(task?.dueDate),
      dueTime: task?.dueTime ?? "",
      priority: task?.priority ?? "NORMAL",
      category: task?.category ?? "OTHER",
      recurrence: task?.recurrence ?? "ONE_OFF",
      recurrenceDay: task?.recurrenceDay ?? "MON",
    },
  });

  const recurrence = watch("recurrence");

  async function onSubmit(values: TaskInput) {
    try {
      if (task) {
        await updateTaskAction(task.id, values);
        toast.success("Task updated");
      } else {
        await createTaskAction(values);
        toast.success("Task created");
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register("description")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Assigned Staff</Label>
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
                  {TASK_CATEGORIES.map((c) => (
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
          <Label>Recurring</Label>
          <Controller
            control={control}
            name="recurrence"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_RECURRENCE.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {recurrence === "WEEKLY" && (
        <div className="space-y-1.5">
          <Label>Day of Week</Label>
          <Controller
            control={control}
            name="recurrenceDay"
            render={({ field }) => (
              <Select value={field.value || "MON"} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {recurrence === "ONE_OFF" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" type="date" {...register("dueDate")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueTime">Due Time</Label>
            <Input id="dueTime" type="time" {...register("dueTime")} />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : task ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
