"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LeadForm } from "./lead-form";
import { deleteLeadAction, addLeadActivityAction } from "@/actions/gym/leads";
import { formatDateTime } from "@/lib/utils";

export type LeadDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  membershipInterest: string | null;
  assignedToId: string | null;
  stage: string;
  nextFollowUpAt: Date | null;
  activities: { id: string; type: string; notes: string | null; createdAt: string; createdByName: string | null }[];
};

export function LeadDetailSheet({
  lead,
  staff,
}: {
  lead: LeadDetail | null;
  staff: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function close() {
    router.push("/gym/leads");
  }

  if (!lead) return null;

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{lead.name}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <LeadForm lead={lead} staff={staff} onSuccess={() => router.refresh()} />

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await deleteLeadAction(lead.id);
                    toast.success("Lead deleted");
                    close();
                  } catch {
                    toast.error("Failed to delete lead");
                  }
                })
              }
              disabled={pending}
            >
              <Trash2 className="size-3.5" />
              Delete Lead
            </Button>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-semibold">Activity</p>
            {lead.activities.length === 0 && <p className="text-sm text-muted-foreground">No activity logged yet.</p>}
            {lead.activities.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {a.type.replace(/_/g, " ")}
                    {a.createdByName ? ` · ${a.createdByName}` : ""}
                  </span>
                  <span>{formatDateTime(a.createdAt)}</span>
                </div>
                {a.notes && <p className="text-foreground/90">{a.notes}</p>}
              </div>
            ))}
          </div>
        </SheetBody>
        <SheetFooter className="flex-col items-stretch gap-2 sm:flex-col">
          <Textarea placeholder="Log a call, email, or note…" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            size="sm"
            disabled={!note.trim() || pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await addLeadActivityAction(lead.id, "NOTE", note);
                  setNote("");
                  toast.success("Activity logged");
                  router.refresh();
                } catch {
                  toast.error("Failed to log activity");
                }
              })
            }
          >
            Log Activity
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
