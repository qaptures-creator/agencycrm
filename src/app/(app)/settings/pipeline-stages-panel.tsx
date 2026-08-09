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
import { createStage, updateStage, deleteStage, reorderStages } from "@/actions/stages";
import type { PipelineStage } from "@prisma/client";

type StageWithCount = PipelineStage & { _count: { leads: number } };

export function PipelineStagesPanel({ stages }: { stages: StageWithCount[] }) {
  const router = useRouter();
  const [newName, setNewName] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<StageWithCount | null>(null);
  const [fallbackId, setFallbackId] = React.useState("");

  async function move(index: number, dir: -1 | 1) {
    const next = [...stages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderStages(next.map((s) => s.id));
    router.refresh();
  }

  async function addStage() {
    if (!newName.trim()) return;
    await createStage(newName.trim());
    setNewName("");
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteStage(deleteTarget.id, fallbackId || undefined);
      toast.success("Stage deleted");
      setDeleteTarget(null);
      setFallbackId("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete stage");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Manage your CRM pipeline stages. Mark one stage as <strong>Won</strong> to unlock client conversion, and one as <strong>Lost</strong> to track lost deals.
      </p>

      <div className="space-y-2">
        {stages.map((stage, i) => (
          <Card key={stage.id} className="flex items-center gap-3 p-3">
            <div className="flex flex-col">
              <button disabled={i === 0} onClick={() => move(i, -1)} className="text-muted-foreground disabled:opacity-30">
                <ChevronUp className="size-3.5" />
              </button>
              <button disabled={i === stages.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground disabled:opacity-30">
                <ChevronDown className="size-3.5" />
              </button>
            </div>
            <input
              type="color"
              value={stage.color}
              onChange={(e) => updateStage(stage.id, { color: e.target.value }).then(() => router.refresh())}
              className="size-7 shrink-0 cursor-pointer rounded border border-border bg-transparent"
            />
            <Input
              defaultValue={stage.name}
              className="h-8 max-w-48"
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value.trim() !== stage.name) {
                  updateStage(stage.id, { name: e.target.value.trim() }).then(() => router.refresh());
                }
              }}
            />
            <Badge variant="secondary">{stage._count.leads} lead{stage._count.leads === 1 ? "" : "s"}</Badge>

            <div className="ml-auto flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch
                  checked={stage.isWon}
                  onCheckedChange={(v) => updateStage(stage.id, { isWon: v, isLost: v ? false : stage.isLost }).then(() => router.refresh())}
                />
                Won
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch
                  checked={stage.isLost}
                  onCheckedChange={(v) => updateStage(stage.id, { isLost: v, isWon: v ? false : stage.isWon }).then(() => router.refresh())}
                />
                Lost
              </label>
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(stage)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Input placeholder="New stage name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStage()} />
        <Button onClick={addStage}>
          <Plus /> Add stage
        </Button>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget._count.leads > 0
                ? `This stage has ${deleteTarget._count.leads} lead(s). Choose where to move them.`
                : "This stage has no leads."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && deleteTarget._count.leads > 0 && (
            <Select value={fallbackId} onValueChange={setFallbackId}>
              <SelectTrigger><SelectValue placeholder="Move leads to…" /></SelectTrigger>
              <SelectContent>
                {stages.filter((s) => s.id !== deleteTarget.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!!deleteTarget && deleteTarget._count.leads > 0 && !fallbackId} onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
