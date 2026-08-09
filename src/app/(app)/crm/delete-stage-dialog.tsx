"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteStage } from "@/actions/stages";
import type { StageWithLeads } from "./kanban-board";

export function DeleteStageDialog({
  open,
  onOpenChange,
  stage,
  leadCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: StageWithLeads;
  leadCount: number;
}) {
  const [fallbackId, setFallbackId] = React.useState<string>("");
  const [otherStages, setOtherStages] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      fetch(`/api/pipeline-stages?exclude=${stage.id}`)
        .then((r) => r.json())
        .then((d) => setOtherStages(d.stages ?? []));
    }
  }, [open, stage.id]);

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteStage(stage.id, fallbackId || undefined);
      toast.success("Stage deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete stage");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{stage.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {leadCount > 0
              ? `This stage has ${leadCount} lead(s). Choose where to move them before deleting.`
              : "This stage has no leads. This action can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {leadCount > 0 && (
          <Select value={fallbackId} onValueChange={setFallbackId}>
            <SelectTrigger>
              <SelectValue placeholder="Move leads to…" />
            </SelectTrigger>
            <SelectContent>
              {otherStages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={loading || (leadCount > 0 && !fallbackId)}
            onClick={handleDelete}
          >
            {loading ? "Deleting…" : "Delete stage"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
