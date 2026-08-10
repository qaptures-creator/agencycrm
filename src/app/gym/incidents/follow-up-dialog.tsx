"use client";

import * as React from "react";
import { toast } from "sonner";
import { updateIncidentFollowUpAction } from "@/actions/gym/incidents";
import { EntityDialog } from "@/components/entity-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/utils";
import type { IncidentRow } from "./incident-list";

export function FollowUpDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: IncidentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [required, setRequired] = React.useState(incident.followUpRequired);
  const [notes, setNotes] = React.useState(incident.followUpNotes ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setRequired(incident.followUpRequired);
    setNotes(incident.followUpNotes ?? "");
  }, [incident]);

  async function save() {
    setSubmitting(true);
    try {
      await updateIncidentFollowUpAction(incident.id, { followUpRequired: required, followUpNotes: notes });
      toast.success("Follow-up updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title="Incident Detail">
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted-foreground">{formatDateTime(incident.occurredAt)}</p>
          <p className="whitespace-pre-wrap">{incident.description}</p>
        </div>
        {incident.actionTaken && (
          <div className="space-y-1 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Action Taken</p>
            <p className="whitespace-pre-wrap">{incident.actionTaken}</p>
          </div>
        )}
        {incident.witnesses && (
          <div className="space-y-1 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Witnesses</p>
            <p>{incident.witnesses}</p>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={required} onCheckedChange={(v) => setRequired(!!v)} />
            Follow-up required
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="followUpNotes">Follow-Up Notes</Label>
            <Textarea id="followUpNotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={submitting} onClick={save}>
            {submitting ? "Saving…" : "Save Follow-Up"}
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}
