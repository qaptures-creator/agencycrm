"use client";

import * as React from "react";
import { toast } from "sonner";
import { setMaintenanceStatusAction, assignMaintenanceTicketAction } from "@/actions/gym/maintenance";
import { MAINTENANCE_STATUSES } from "@/lib/gym/constants";
import { EntityDialog } from "@/components/entity-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { TASK_PRIORITIES } from "@/lib/gym/constants";
import { formatDateTime } from "@/lib/utils";
import type { TicketRow } from "./maintenance-board";

export function TicketDetailDialog({
  ticket,
  staff,
  open,
  onOpenChange,
}: {
  ticket: TicketRow;
  staff: { id: string; fullName: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = React.useState(ticket.status);
  const [resolutionNotes, setResolutionNotes] = React.useState(ticket.resolutionNotes ?? "");
  const [assignedToId, setAssignedToId] = React.useState(ticket.assignedTo?.id ?? "unassigned");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setStatus(ticket.status);
    setResolutionNotes(ticket.resolutionNotes ?? "");
    setAssignedToId(ticket.assignedTo?.id ?? "unassigned");
  }, [ticket]);

  function saveStatus(next: string) {
    setStatus(next);
    startTransition(async () => {
      try {
        await setMaintenanceStatusAction(ticket.id, next, resolutionNotes);
        toast.success("Ticket status updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function saveAssignee(next: string) {
    setAssignedToId(next);
    startTransition(async () => {
      try {
        await assignMaintenanceTicketAction(ticket.id, next === "unassigned" ? null : next);
        toast.success("Ticket assigned");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function saveNotes() {
    startTransition(async () => {
      try {
        await setMaintenanceStatusAction(ticket.id, status, resolutionNotes);
        toast.success("Resolution notes saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={ticket.issue}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <GymStatusBadge list={TASK_PRIORITIES} value={ticket.priority} />
          <span>Reported {formatDateTime(ticket.reportedAt)}</span>
          {ticket.equipment && <span>· {ticket.equipment.name}</span>}
          {ticket.area && <span>· {ticket.area}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={saveStatus} disabled={pending}>
              <SelectTrigger>
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
          <div className="space-y-1.5">
            <Label>Assigned To</Label>
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

        <div className="space-y-1.5">
          <Label>Reported By</Label>
          <p className="text-sm text-muted-foreground">{ticket.reportedBy?.fullName ?? "—"}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resolutionNotes">Resolution Notes</Label>
          <Textarea
            id="resolutionNotes"
            rows={3}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="What was done to fix this…"
          />
          {ticket.resolvedAt && <p className="text-xs text-muted-foreground">Resolved {formatDateTime(ticket.resolvedAt)}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={pending} onClick={saveNotes}>
            Save Notes
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}
