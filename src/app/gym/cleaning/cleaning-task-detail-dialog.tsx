"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, History } from "lucide-react";
import {
  setCleaningTaskStatusAction,
  updateCleaningTaskAction,
  attachCleaningPhotoAction,
  deleteCleaningTaskAction,
  getCleaningTaskAuditAction,
} from "@/actions/gym/cleaning";
import { CLEANING_TASK_STATUSES } from "@/lib/gym/constants";
import { EntityDialog } from "@/components/entity-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { formatDateTime } from "@/lib/utils";
import { labelFor } from "@/lib/gym/constants";
import type { CleaningTaskRow } from "./cleaning-dashboard";

export function CleaningTaskDetailDialog({
  task,
  staff,
  canManage,
  open,
  onOpenChange,
}: {
  task: CleaningTaskRow;
  staff: { id: string; fullName: string }[];
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = React.useState(task.status);
  const [notes, setNotes] = React.useState(task.notes ?? "");
  const [photoUrl, setPhotoUrl] = React.useState(task.photoUrl ?? "");
  const [assignedToId, setAssignedToId] = React.useState(task.assignedTo?.id ?? "unassigned");
  const [pending, startTransition] = React.useTransition();
  const [audit, setAudit] = React.useState<Awaited<ReturnType<typeof getCleaningTaskAuditAction>>>([]);

  React.useEffect(() => {
    setStatus(task.status);
    setNotes(task.notes ?? "");
    setPhotoUrl(task.photoUrl ?? "");
    setAssignedToId(task.assignedTo?.id ?? "unassigned");
  }, [task]);

  React.useEffect(() => {
    if (!open) return;
    getCleaningTaskAuditAction(task.id)
      .then(setAudit)
      .catch(() => setAudit([]));
  }, [open, task.id]);

  function saveDescriptive(overrides: Partial<{ assignedToId: string | null; notes: string; photoUrl: string }>) {
    startTransition(async () => {
      try {
        await updateCleaningTaskAction(task.id, {
          date: task.date.slice(0, 10),
          zoneId: task.zone.id,
          whatBeingCleaned: task.whatBeingCleaned,
          assignedToId: overrides.assignedToId !== undefined ? overrides.assignedToId ?? "" : assignedToId === "unassigned" ? "" : assignedToId,
          notes: overrides.notes ?? notes,
          photoUrl: overrides.photoUrl ?? photoUrl,
          status,
        });
        toast.success("Saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function changeStatus(next: string) {
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      try {
        await setCleaningTaskStatusAction(task.id, next);
        toast.success(next === "COMPLETE" ? "Marked complete" : "Status updated");
      } catch (err) {
        setStatus(prev);
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function markComplete() {
    setStatus("COMPLETE");
    startTransition(async () => {
      try {
        await setCleaningTaskStatusAction(task.id, "COMPLETE");
        toast.success("Marked complete");
      } catch (err) {
        setStatus(task.status);
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function saveAssignee(next: string) {
    setAssignedToId(next);
    saveDescriptive({ assignedToId: next === "unassigned" ? null : next });
  }

  function savePhoto() {
    startTransition(async () => {
      try {
        await attachCleaningPhotoAction(task.id, photoUrl);
        toast.success("Photo attached");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteCleaningTaskAction(task.id);
        toast.success("Task deleted");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={task.whatBeingCleaned}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <GymStatusBadge list={CLEANING_TASK_STATUSES} value={task.status} />
          <span>· {task.zone.name}</span>
          <span>· {new Date(task.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={changeStatus} disabled={pending}>
              <SelectTrigger>
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
          <div className="space-y-1.5">
            <Label>Assigned Staff</Label>
            <Select value={assignedToId} onValueChange={saveAssignee} disabled={pending}>
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
          </div>
        </div>

        {canManage && status !== "COMPLETE" && (
          <Button type="button" className="w-full gap-1.5" disabled={pending} onClick={markComplete}>
            <CheckCircle2 className="size-4" />
            Mark Complete
          </Button>
        )}

        {task.completedBy && (
          <p className="text-xs text-muted-foreground">
            Completed by {task.completedBy.name}
            {task.completedAt && ` · ${formatDateTime(task.completedAt)}`}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveDescriptive({ notes })}
            placeholder="e.g. Photos received on WhatsApp at 14:20"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="photoUrl">Photo Proof (optional)</Label>
          <div className="flex gap-2">
            <Input id="photoUrl" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://… (attach WhatsApp photo link)" />
            <Button type="button" variant="outline" disabled={pending} onClick={savePhoto}>
              Save
            </Button>
          </div>
          {task.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={task.photoUrl} alt="Cleaning proof" className="mt-2 max-h-40 rounded-lg border border-border object-cover" />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <History className="size-3.5" /> History
          </Label>
          {audit.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes logged yet.</p>
          ) : (
            <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {audit.map((row) => (
                <li key={row.id}>
                  <span className="text-foreground">{row.user?.name ?? "System"}</span>{" "}
                  {row.action === "CLEANING_TASK_STATUS_CHANGED" && row.metadata && typeof row.metadata === "object"
                    ? `changed status ${labelFor(CLEANING_TASK_STATUSES, (row.metadata as Record<string, string>).from)} → ${labelFor(CLEANING_TASK_STATUSES, (row.metadata as Record<string, string>).to)}`
                    : row.action.replace("CLEANING_TASK_", "").replace(/_/g, " ").toLowerCase()}{" "}
                  · {formatDateTime(row.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {canManage ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this cleaning task?</AlertDialogTitle>
                  <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}
