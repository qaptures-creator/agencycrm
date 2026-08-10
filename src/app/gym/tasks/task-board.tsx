"use client";

import * as React from "react";
import { Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { TaskForm } from "./task-form";
import { TaskQuickComplete } from "@/components/gym/dashboard/task-quick-complete";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITIES, TASK_CATEGORIES, labelFor } from "@/lib/gym/constants";
import { cn, formatDate } from "@/lib/utils";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  category: string;
  recurrence: string;
  recurrenceDay: string | null;
  status: string;
  displayStatus: string;
  dueDate: Date | null;
  dueTime: string | null;
  assignedTo: { id: string; fullName: string } | null;
  createdBy: { id: string; name: string } | null;
};

const FILTERS = ["All", "Due Today", "Overdue", "Completed"] as const;
type Filter = (typeof FILTERS)[number];

export function TaskBoard({ tasks, staff }: { tasks: TaskRow[]; staff: { id: string; fullName: string }[] }) {
  const [filter, setFilter] = React.useState<Filter>("All");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TaskRow | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = tasks.filter((t) => {
    if (filter === "Due Today") {
      const due = t.dueDate ? new Date(t.dueDate) : null;
      const isToday = due && due.toDateString() === today.toDateString();
      return (isToday || t.recurrence !== "ONE_OFF") && t.status !== "COMPLETED";
    }
    if (filter === "Overdue") return t.displayStatus === "OVERDUE";
    if (filter === "Completed") return t.status === "COMPLETED";
    return true;
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(task: TaskRow) {
    setEditing(task);
    setDialogOpen(true);
  }

  const completionByStaff = React.useMemo(() => {
    const map = new Map<string, { name: string; total: number; done: number }>();
    for (const t of tasks) {
      if (!t.assignedTo) continue;
      const entry = map.get(t.assignedTo.id) ?? { name: t.assignedTo.fullName, total: 0, done: 0 };
      entry.total += 1;
      if (t.status === "COMPLETED") entry.done += 1;
      map.set(t.assignedTo.id, entry);
    }
    return Array.from(map.values());
  }, [tasks]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          New Task
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks here" description="Nothing matches this filter." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3">
              <TaskQuickComplete taskId={task.id} completed={task.status === "COMPLETED"} />
              <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(task)}>
                <div className="flex items-center gap-2">
                  <p className={cn("truncate text-sm font-medium", task.status === "COMPLETED" && "text-muted-foreground line-through")}>
                    {task.title}
                  </p>
                  {task.recurrence !== "ONE_OFF" && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {task.recurrence === "DAILY" ? "Daily" : "Weekly"}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {task.assignedTo?.fullName ?? "Unassigned"} · {labelFor(TASK_CATEGORIES, task.category)}
                  {task.dueDate && ` · Due ${formatDate(task.dueDate)}`}
                  {task.dueTime && ` ${task.dueTime}`}
                </p>
              </button>
              {task.displayStatus === "OVERDUE" && <Badge variant="destructive">Overdue</Badge>}
              <GymStatusBadge list={TASK_PRIORITIES} value={task.priority} />
            </div>
          ))}
        </div>
      )}

      {completionByStaff.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Completion Rate by Staff</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {completionByStaff.map((s) => (
              <div key={s.name} className="rounded-lg border border-border bg-secondary/20 p-3">
                <p className="truncate text-xs text-muted-foreground">{s.name}</p>
                <p className="mt-1 text-lg font-semibold">
                  {s.total > 0 ? Math.round((s.done / s.total) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.done}/{s.total} completed
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit Task" : "New Task"}>
        <TaskForm
          task={editing ? { ...editing, assignedToId: editing.assignedTo?.id ?? null } : undefined}
          staff={staff}
          onSuccess={() => setDialogOpen(false)}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
