"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { CAMPAIGN_TYPES, labelFor } from "@/lib/gym/constants";
import { CampaignForm, CAMPAIGN_STATUSES } from "./campaign-form";
import { deleteMarketingCampaignAction } from "@/actions/gym/marketing";
import { formatDate } from "@/lib/utils";

type CampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  leadCount: number;
  joinedCount: number;
};

export function CampaignTracker({ campaigns, canManage }: { campaigns: CampaignRow[]; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CampaignRow | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: CampaignRow) {
    if (!canManage) return;
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    try {
      await deleteMarketingCampaignAction(id);
      toast.success("Campaign removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="size-4" />
            New Campaign
          </Button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <EmptyState icon={Target} title="No campaigns yet" description="Track membership offers, referral pushes, and events here." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {campaigns.map((row) => {
            const conversionRate = row.leadCount > 0 ? Math.round((row.joinedCount / row.leadCount) * 100) : 0;
            return (
              <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(row)} disabled={!canManage}>
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {labelFor(CAMPAIGN_TYPES, row.type)}
                    {row.startDate && ` · From ${formatDate(row.startDate)}`}
                    {row.endDate && ` to ${formatDate(row.endDate)}`}
                  </p>
                </button>
                <div className="hidden shrink-0 flex-col items-end text-xs text-muted-foreground sm:flex">
                  <span>
                    {row.leadCount} lead{row.leadCount === 1 ? "" : "s"} · {row.joinedCount} joined
                  </span>
                  <span>{conversionRate}% conversion</span>
                </div>
                <GymStatusBadge list={CAMPAIGN_STATUSES} value={row.status} />
                {canManage && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
                        <AlertDialogDescription>Linked leads will keep their history but lose the campaign link.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(row.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit Campaign" : "New Campaign"}>
        <CampaignForm campaign={editing ?? undefined} onSuccess={() => setDialogOpen(false)} onCancel={() => setDialogOpen(false)} />
      </EntityDialog>
    </div>
  );
}
