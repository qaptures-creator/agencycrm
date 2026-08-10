"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Phone, UserPlus, Target, Archive } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { ENQUIRY_STATUSES, ENQUIRY_CATEGORIES, TASK_PRIORITIES, labelFor } from "@/lib/gym/constants";
import { formatDateTime } from "@/lib/utils";
import {
  setEnquiryStatusAction,
  assignEnquiryAction,
  addEnquiryNoteAction,
  scheduleFollowUpAction,
  convertEnquiryToLeadAction,
  convertEnquiryToMemberAction,
} from "@/actions/gym/enquiries";

export type EnquiryDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  category: string;
  status: string;
  priority: string;
  source: string;
  followUpAt: string | null;
  createdAt: string;
  assignedToId: string | null;
  convertedMemberId: string | null;
  messages: { id: string; direction: string; body: string; createdAt: string; authorName: string | null }[];
};

export function EnquiryDetailSheet({
  enquiry,
  staff,
  emailConnected,
}: {
  enquiry: EnquiryDetail | null;
  staff: { id: string; fullName: string }[];
  emailConnected: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [followUp, setFollowUp] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function close() {
    router.push("/gym/enquiries");
  }

  if (!enquiry) return null;

  function run(fn: () => Promise<unknown>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(successMsg);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{enquiry.name}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {enquiry.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3" />
                {enquiry.email}
              </span>
            )}
            {enquiry.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3" />
                {enquiry.phone}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <GymStatusBadge list={ENQUIRY_STATUSES} value={enquiry.status} />
            <GymStatusBadge list={TASK_PRIORITIES} value={enquiry.priority} />
          </div>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {!emailConnected && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
              Email Integration Required — this enquiry was logged manually. Connect admin@musclemassacre.com in
              Settings → Integrations to pull emails in automatically and reply from here.
            </div>
          )}

          {enquiry.subject && <p className="text-sm font-medium">{enquiry.subject}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={enquiry.status} onValueChange={(v) => run(() => setEnquiryStatusAction(enquiry.id, v), "Status updated")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENQUIRY_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Assigned To</label>
              <Select
                value={enquiry.assignedToId ?? "unassigned"}
                onValueChange={(v) => run(() => assignEnquiryAction(enquiry.id, v === "unassigned" ? null : v), "Enquiry assigned")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="h-8 w-36 text-xs" />
              <Button
                size="sm"
                variant="outline"
                disabled={!followUp || pending}
                onClick={() => run(() => scheduleFollowUpAction(enquiry.id, followUp), "Follow-up scheduled")}
              >
                Schedule Follow-Up
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await convertEnquiryToLeadAction(enquiry.id);
                  router.push("/gym/leads");
                }, "Converted to lead")
              }
            >
              <Target className="size-3.5" />
              Convert to Lead
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={pending || !!enquiry.convertedMemberId}
              onClick={() => run(() => convertEnquiryToMemberAction(enquiry.id), "Converted to member")}
            >
              <UserPlus className="size-3.5" />
              Convert to Member
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={pending}
              onClick={() => run(() => setEnquiryStatusAction(enquiry.id, "CLOSED"), "Enquiry archived")}
            >
              <Archive className="size-3.5" />
              Archive
            </Button>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-semibold">Conversation</p>
            {enquiry.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {enquiry.messages.map((m) => (
              <div key={m.id} className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {m.direction === "INTERNAL_NOTE" ? `Internal note${m.authorName ? ` · ${m.authorName}` : ""}` : m.direction === "INBOUND" ? "Received" : "Sent"}
                  </span>
                  <span>{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-foreground/90">{m.body}</p>
              </div>
            ))}
          </div>
        </SheetBody>

        <SheetFooter className="flex-col items-stretch gap-2 sm:flex-col">
          <Textarea placeholder="Add an internal note…" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            size="sm"
            disabled={!note.trim() || pending}
            onClick={() =>
              run(async () => {
                await addEnquiryNoteAction(enquiry.id, note);
                setNote("");
              }, "Note added")
            }
          >
            Add Note
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
