"use client";

import * as React from "react";
import { toast } from "sonner";
import { reportEquipmentIssueAction } from "@/actions/gym/equipment";
import { TASK_PRIORITIES } from "@/lib/gym/constants";
import { EntityDialog } from "@/components/entity-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ReportIssueDialog({
  equipmentId,
  equipmentName,
  open,
  onOpenChange,
}: {
  equipmentId: string;
  equipmentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [issue, setIssue] = React.useState("");
  const [priority, setPriority] = React.useState("NORMAL");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    if (!issue.trim()) return;
    setSubmitting(true);
    try {
      await reportEquipmentIssueAction(equipmentId, { issue, priority });
      toast.success("Issue reported — a maintenance ticket has been created");
      setIssue("");
      setPriority("NORMAL");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={`Report Issue — ${equipmentName}`}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="issue">What&apos;s wrong? *</Label>
          <Textarea id="issue" rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Describe the fault…" />
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!issue.trim() || submitting} onClick={submit}>
            {submitting ? "Reporting…" : "Report Issue"}
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}
