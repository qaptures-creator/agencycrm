"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Settings2, SprayCan, CheckCircle2, Clock, Camera, XCircle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLEANING_TASK_STATUSES } from "@/lib/gym/constants";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CleaningTaskForm } from "./cleaning-task-form";
import { CleaningTaskDetailDialog } from "./cleaning-task-detail-dialog";
import { ManageZonesDialog, type ZoneFull } from "./manage-zones-dialog";
import { setCleaningTaskStatusAction } from "@/actions/gym/cleaning";
import Link from "next/link";

export type CleaningTaskRow = {
  id: string;
  date: string;
  whatBeingCleaned: string;
  status: string;
  notes: string | null;
  photoUrl: string | null;
  completedAt: string | null;
  zone: { id: string; name: string };
  assignedTo: { id: string; fullName: string } | null;
  completedBy: { id: string; name: string } | null;
};

type ZoneOption = { id: string; name: string };
type StaffOption = { id: string; fullName: string };

function fmtDayHeading(dateIso: string) {
  return format(new Date(dateIso + "T00:00:00"), "EEEE d MMMM yyyy");
}

export function CleaningDashboard({
  dateIso,
  zones,
  tasks,
  staff,
  allZones,
  canManage,
}: {
  dateIso: string;
  zones: ZoneOption[];
  tasks: CleaningTaskRow[];
  staff: StaffOption[];
  allZones: ZoneFull[];
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = React.useState(searchParams.get("new") === "1");
  const [createZoneId, setCreateZoneId] = React.useState<string | undefined>(undefined);
  const [detailTask, setDetailTask] = React.useState<CleaningTaskRow | null>(null);
  const [manageZonesOpen, setManageZonesOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const todayIso = new Date().toISOString().slice(0, 10);

  function goToDate(next: string) {
    router.push(`/gym/cleaning?date=${next}`);
  }

  function shiftDay(offset: number) {
    const d = new Date(dateIso + "T00:00:00");
    d.setDate(d.getDate() + offset);
    goToDate(d.toISOString().slice(0, 10));
  }

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, IN_PROGRESS: 0, AWAITING_REVIEW: 0, COMPLETE: 0, MISSED: 0 };
    for (const t of tasks) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tasks]);

  const groups = React.useMemo(() => {
    const map = new Map<string, { zone: ZoneOption; tasks: CleaningTaskRow[] }>();
    for (const z of zones) map.set(z.id, { zone: z, tasks: [] });
    for (const t of tasks) {
      const existing = map.get(t.zone.id);
      if (existing) existing.tasks.push(t);
      else map.set(t.zone.id, { zone: t.zone, tasks: [t] });
    }
    return Array.from(map.values());
  }, [zones, tasks]);

  function quickStatusChange(task: CleaningTaskRow, status: string) {
    startTransition(async () => {
      try {
        await setCleaningTaskStatusAction(task.id, status);
        toast.success(status === "COMPLETE" ? "Marked complete" : "Status updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function openCreate(zoneId?: string) {
    setCreateZoneId(zoneId);
    setCreateOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => goToDate(todayIso)} disabled={dateIso === todayIso}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftDay(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <label className="relative ml-1 flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5 text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            <input
              type="date"
              suppressHydrationWarning
              value={dateIso}
              onChange={(e) => e.target.value && goToDate(e.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </label>
          <span className="ml-1 text-sm font-medium text-muted-foreground">{fmtDayHeading(dateIso)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/gym/cleaning/weekly">Weekly View</Link>
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageZonesOpen(true)}>
              <Settings2 className="size-3.5" />
              Manage Zones
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => openCreate()}>
            <Plus className="size-4" />
            New Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Complete" value={counts.COMPLETE} icon={CheckCircle2} tone="success" />
        <StatCard label="Awaiting Review" value={counts.AWAITING_REVIEW} icon={Camera} tone={counts.AWAITING_REVIEW > 0 ? "warning" : "default"} />
        <StatCard label="Pending" value={counts.PENDING} icon={Clock} />
        <StatCard label="Missed" value={counts.MISSED} icon={XCircle} tone={counts.MISSED > 0 ? "destructive" : "default"} />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={SprayCan}
          title="No cleaning zones set up"
          description={canManage ? "Add your first zone to start logging cleaning tasks." : "Ask a manager to set up cleaning zones."}
          action={
            canManage && (
              <Button size="sm" onClick={() => setManageZonesOpen(true)}>
                Manage Zones
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map(({ zone, tasks: zoneTasks }) => (
            <div key={zone.id} className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <h2 className="font-display text-sm font-semibold">{zone.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {zoneTasks.length} task{zoneTasks.length === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={() => openCreate(zone.id)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {zoneTasks.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">No tasks scheduled for this zone today.</p>
              ) : (
                <div className="divide-y divide-border">
                  {zoneTasks.map((task) => (
                    <div key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setDetailTask(task)}>
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{task.whatBeingCleaned}</p>
                          <GymStatusBadge list={CLEANING_TASK_STATUSES} value={task.status} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.assignedTo ? task.assignedTo.fullName : "Unassigned"}
                          {task.notes && ` · ${task.notes}`}
                        </p>
                      </button>
                      <div className={cn("shrink-0", pending && "opacity-60")} onClick={(e) => e.stopPropagation()}>
                        <Select value={task.status} onValueChange={(v) => quickStatusChange(task, v)} disabled={pending}>
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CLEANING_TASK_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {canManage && task.status !== "COMPLETE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 gap-1.5 border-success/40 text-success hover:bg-success/10"
                          disabled={pending}
                          onClick={(e) => {
                            e.stopPropagation();
                            quickStatusChange(task, "COMPLETE");
                          }}
                        >
                          <CheckCircle2 className="size-3.5" />
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <EntityDialog open={createOpen} onOpenChange={setCreateOpen} title="New Cleaning Task">
        <CleaningTaskForm
          dateIso={dateIso}
          zones={createZoneId ? zones.filter((z) => z.id === createZoneId).concat(zones.filter((z) => z.id !== createZoneId)) : zones}
          staff={staff}
          onSuccess={() => setCreateOpen(false)}
          onCancel={() => setCreateOpen(false)}
        />
      </EntityDialog>

      {detailTask && (
        <CleaningTaskDetailDialog
          task={detailTask}
          staff={staff}
          canManage={canManage}
          open={!!detailTask}
          onOpenChange={(open) => !open && setDetailTask(null)}
        />
      )}

      {canManage && <ManageZonesDialog open={manageZonesOpen} onOpenChange={setManageZonesOpen} zones={allZones} />}
    </div>
  );
}
