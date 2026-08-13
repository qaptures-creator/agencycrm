"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { EntityDialog } from "@/components/entity-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import {
  createCleaningZoneAction,
  updateCleaningZoneAction,
  deleteCleaningZoneAction,
  reorderCleaningZonesAction,
} from "@/actions/gym/cleaning";

export type ZoneFull = { id: string; name: string; order: number; active: boolean };

export function ManageZonesDialog({
  open,
  onOpenChange,
  zones,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: ZoneFull[];
}) {
  const router = useRouter();
  const [newName, setNewName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  async function addZone() {
    if (!newName.trim()) return;
    try {
      await createCleaningZoneAction(newName.trim());
      setNewName("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add zone");
    }
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...zones];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(async () => {
      await reorderCleaningZonesAction(next.map((z) => z.id));
      router.refresh();
    });
  }

  function rename(id: string, name: string) {
    startTransition(async () => {
      try {
        await updateCleaningZoneAction(id, { name });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't rename zone");
      }
    });
  }

  function toggleActive(id: string, active: boolean) {
    startTransition(async () => {
      try {
        await updateCleaningZoneAction(id, { active });
        toast.success(active ? "Zone activated" : "Zone deactivated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update zone");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteCleaningZoneAction(id);
        toast.success("Zone deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete zone");
      }
    });
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title="Manage Cleaning Zones" description="Configure the zones/areas staff clean — add, rename, reorder, deactivate.">
      <div className="space-y-4">
        <div className="space-y-2">
          {zones.map((zone, i) => (
            <div key={zone.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <div className="flex flex-col">
                <button disabled={i === 0 || pending} onClick={() => move(i, -1)} className="text-muted-foreground disabled:opacity-30">
                  <ChevronUp className="size-3.5" />
                </button>
                <button disabled={i === zones.length - 1 || pending} onClick={() => move(i, 1)} className="text-muted-foreground disabled:opacity-30">
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
              <Input
                defaultValue={zone.name}
                className="h-8 flex-1"
                disabled={pending}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== zone.name) rename(zone.id, v);
                }}
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={zone.active} disabled={pending} onCheckedChange={(v) => toggleActive(zone.id, v)} />
                Active
              </label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete &ldquo;{zone.name}&rdquo;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Zones with existing cleaning tasks can&apos;t be deleted — deactivate instead so history is kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(zone.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
          {zones.length === 0 && <p className="text-sm text-muted-foreground">No zones yet — add one below.</p>}
        </div>

        <div className="flex gap-2">
          <Input placeholder="New zone name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addZone()} />
          <Button onClick={addZone}>
            <Plus /> Add zone
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}
