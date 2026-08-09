"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createDeliverableStatus,
  updateDeliverableStatusOption,
  deleteDeliverableStatus,
  reorderDeliverableStatuses,
} from "@/actions/deliverables";
import type { DeliverableStatusOption } from "@prisma/client";

type StatusWithCount = DeliverableStatusOption & { _count: { deliverables: number } };

export function DeliverableStatusesPanel({ statuses }: { statuses: StatusWithCount[] }) {
  const router = useRouter();
  const [newName, setNewName] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<StatusWithCount | null>(null);
  const [fallbackId, setFallbackId] = React.useState("");

  async function move(index: number, dir: -1 | 1) {
    const next = [...statuses];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderDeliverableStatuses(next.map((s) => s.id));
    router.refresh();
  }

  async function addStatus() {
    if (!newName.trim()) return;
    await createDeliverableStatus(newName.trim());
    setNewName("");
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDeliverableStatus(deleteTarget.id, fallbackId || undefined);
      toast.success("Status deleted");
      setDeleteTarget(null);
      setFallbackId("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete status");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customize the statuses used across your deliverables tracker. Mark a status as <strong>Terminal</strong> to treat it as &ldquo;delivered&rdquo; — it stops counting toward overdue items.
      </p>

      <div className="space-y-2">
        {statuses.map((status, i) => (
          <Card key={status.id} className="flex items-center gap-3 p-3">
            <div className="flex flex-col">
              <button disabled={i === 0} onClick={() => move(i, -1)} className="text-muted-foreground disabled:opacity-30">
                <ChevronUp className="size-3.5" />
              </button>
              <button disabled={i === statuses.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground disabled:opacity-30">
                <ChevronDown className="size-3.5" />
              </button>
            </div>
            <input
              type="color"
              value={status.color}
              onChange={(e) => updateDeliverableStatusOption(status.id, { color: e.target.value }).then(() => router.refresh())}
              className="size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent"
            />
            <Input
              defaultValue={status.name}
              className="h-8 max-w-48"
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value.trim() !== status.name) {
                  updateDeliverableStatusOption(status.id, { name: e.target.value.trim() }).then(() => router.refresh());
                }
              }}
            />
            <Badge variant="secondary">{status._count.deliverables} item{status._count.deliverables === 1 ? "" : "s"}</Badge>

            <div className="ml-auto flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch
                  checked={status.isTerminal}
                  onCheckedChange={(v) => updateDeliverableStatusOption(status.id, { isTerminal: v }).then(() => router.refresh())}
                />
                Terminal
              </label>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(status)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Input placeholder="New status name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStatus()} />
        <Button onClick={addStatus}>
          <Plus /> Add status
        </Button>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget._count.deliverables > 0
                ? `This status is used by ${deleteTarget._count.deliverables} deliverable(s). Choose where to move them.`
                : "This status isn't used by any deliverables."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && deleteTarget._count.deliverables > 0 && (
            <Select value={fallbackId} onValueChange={setFallbackId}>
              <SelectTrigger><SelectValue placeholder="Move deliverables to…" /></SelectTrigger>
              <SelectContent>
                {statuses.filter((s) => s.id !== deleteTarget.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!!deleteTarget && deleteTarget._count.deliverables > 0 && !fallbackId} onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
