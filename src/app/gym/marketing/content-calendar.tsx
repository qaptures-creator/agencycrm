"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Clapperboard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ContentForm } from "./content-form";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { MARKETING_PLATFORMS, MARKETING_CONTENT_STATUSES, labelFor } from "@/lib/gym/constants";
import { deleteMarketingContentAction } from "@/actions/gym/marketing";
import { cn, formatDate } from "@/lib/utils";

type ContentRow = {
  id: string;
  title: string;
  platform: string;
  shootDate: Date | null;
  publishDate: Date | null;
  status: string;
  notes: string | null;
  owner: { id: string; fullName: string } | null;
};

const FILTERS = ["All", ...MARKETING_CONTENT_STATUSES.map((s) => s.value)] as const;

export function ContentCalendar({
  content,
  staff,
  canManage,
}: {
  content: ContentRow[];
  staff: { id: string; fullName: string }[];
  canManage: boolean;
}) {
  const [filter, setFilter] = React.useState<string>("All");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContentRow | null>(null);

  const filtered = filter === "All" ? content : content.filter((c) => c.status === filter);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: ContentRow) {
    if (!canManage) return;
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    try {
      await deleteMarketingContentAction(id);
      toast.success("Content removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

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
              {f === "All" ? "All" : labelFor(MARKETING_CONTENT_STATUSES, f)}
            </button>
          ))}
        </div>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="size-4" />
            New Content
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Clapperboard} title="No content here" description="Nothing matches this filter yet." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(row)} disabled={!canManage}>
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {labelFor(MARKETING_PLATFORMS, row.platform)} · {row.owner?.fullName ?? "Unassigned"}
                  {row.shootDate && ` · Shoot ${formatDate(row.shootDate)}`}
                  {row.publishDate && ` · Publish ${formatDate(row.publishDate)}`}
                </p>
              </button>
              <GymStatusBadge list={MARKETING_CONTENT_STATUSES} value={row.status} />
              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this content item?</AlertDialogTitle>
                      <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(row.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit Content" : "New Content"}>
        <ContentForm
          content={editing ? { ...editing, ownerId: editing.owner?.id ?? null } : undefined}
          staff={staff}
          onSuccess={() => setDialogOpen(false)}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
