"use client";

import * as React from "react";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { addMemberNoteAction } from "@/actions/gym/members";
import { formatDateTime } from "@/lib/utils";

export type MemberNoteRow = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
};

export function MemberNotes({ memberId, notes }: { memberId: string; notes: MemberNoteRow[] }) {
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        await addMemberNoteAction(memberId, body);
        setBody("");
        toast.success("Note added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Add an internal note about this member…"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!body.trim() || pending} onClick={submit}>
            Add Note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" description="Internal notes about this member will appear here." className="border-none bg-transparent py-8" />
      ) : (
        <div className="space-y-2.5">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{n.authorName ?? "Unknown staff"}</span>
                <span>{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-foreground/90">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
