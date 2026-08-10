"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Megaphone, Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AnnouncementForm } from "./announcement-form";
import { deleteAnnouncementAction, togglePinAnnouncementAction } from "@/actions/gym/announcements";
import { formatDateTime, cn } from "@/lib/utils";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  createdBy: { name: string } | null;
};

export function AnnouncementFeed({ announcements, canManage }: { announcements: AnnouncementRow[]; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  async function handleDelete(id: string) {
    try {
      await deleteAnnouncementAction(id);
      toast.success("Announcement removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleTogglePin(id: string, pinned: boolean) {
    try {
      await togglePinAnnouncementAction(id, !pinned);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New Announcement
          </Button>
        </div>
      )}

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Post one and every active staff member will see it next time they log in." />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={cn(
                "rounded-xl border bg-card p-4",
                a.pinned ? "border-primary/40 bg-primary/5" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin className="size-3.5 text-primary" />}
                  <p className="text-sm font-semibold">{a.title}</p>
                  {a.pinned && <Badge variant="outline" className="text-[10px]">Pinned</Badge>}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleTogglePin(a.id, a.pinned)}>
                      <Pin className="size-3.5" />
                      {a.pinned ? "Unpin" : "Pin"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
                          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {a.createdBy?.name ?? "Management"} · {formatDateTime(a.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title="New Announcement">
        <AnnouncementForm onSuccess={() => setDialogOpen(false)} onCancel={() => setDialogOpen(false)} />
      </EntityDialog>
    </div>
  );
}
