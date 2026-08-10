"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { MAINTENANCE_STATUSES, TASK_PRIORITIES } from "@/lib/gym/constants";
import { cn, formatRelativeToNow } from "@/lib/utils";
import { MaintenanceForm } from "./maintenance-form";
import { TicketDetailDialog } from "./ticket-detail-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setMaintenanceStatusAction } from "@/actions/gym/maintenance";

export type TicketRow = {
  id: string;
  issue: string;
  area: string | null;
  priority: string;
  status: string;
  reportedAt: Date;
  resolutionNotes: string | null;
  resolvedAt: Date | null;
  equipment: { id: string; name: string } | null;
  reportedBy: { id: string; fullName: string } | null;
  assignedTo: { id: string; fullName: string } | null;
};

const FILTERS = ["All", "Open", "Fixed"] as const;
type Filter = (typeof FILTERS)[number];

export function MaintenanceBoard({
  tickets,
  staff,
  equipment,
}: {
  tickets: TicketRow[];
  staff: { id: string; fullName: string }[];
  equipment: { id: string; name: string }[];
}) {
  const searchParams = useSearchParams();
  const [filter, setFilter] = React.useState<Filter>("All");
  const [createOpen, setCreateOpen] = React.useState(searchParams.get("new") === "1");
  const [detailTicket, setDetailTicket] = React.useState<TicketRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filtered = tickets.filter((t) => {
    if (filter === "Open") return t.status !== "FIXED";
    if (filter === "Fixed") return t.status === "FIXED";
    return true;
  });

  function quickStatusChange(ticket: TicketRow, status: string) {
    startTransition(async () => {
      try {
        await setMaintenanceStatusAction(ticket.id, status);
        toast.success("Ticket status updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-4">
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
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Ticket
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No tickets here" description="Nothing matches this filter." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((ticket) => (
            <div key={ticket.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setDetailTicket(ticket)}>
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{ticket.issue}</p>
                  <GymStatusBadge list={TASK_PRIORITIES} value={ticket.priority} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {ticket.equipment?.name ?? ticket.area ?? "General"} · Reported {formatRelativeToNow(ticket.reportedAt)}
                  {ticket.reportedBy && ` by ${ticket.reportedBy.fullName}`}
                  {ticket.assignedTo && ` · Assigned to ${ticket.assignedTo.fullName}`}
                </p>
              </button>
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Select value={ticket.status} onValueChange={(v) => quickStatusChange(ticket, v)} disabled={pending}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}

      <EntityDialog open={createOpen} onOpenChange={setCreateOpen} title="New Maintenance Ticket">
        <MaintenanceForm staff={staff} equipment={equipment} onSuccess={() => setCreateOpen(false)} onCancel={() => setCreateOpen(false)} />
      </EntityDialog>

      {detailTicket && (
        <TicketDetailDialog
          ticket={detailTicket}
          staff={staff}
          open={!!detailTicket}
          onOpenChange={(open) => !open && setDetailTicket(null)}
        />
      )}
    </div>
  );
}
