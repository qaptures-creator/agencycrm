"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ProposalDocument } from "@/components/proposal/proposal-document";
import { DownloadPdfButton } from "@/components/proposal/download-pdf-button";
import { SectionListEditor } from "./section-editor";
import { updateProposal, deleteProposal } from "@/actions/proposals";
import { PROPOSAL_LAYOUTS, type ProposalContent, type ProposalLayout } from "@/lib/proposal-types";

type ProposalWorkspaceProps = {
  proposal: { id: string; title: string; layout: ProposalLayout; content: ProposalContent };
  client: { id: string; companyName: string; color: string };
};

export function ProposalWorkspace({ proposal, client }: ProposalWorkspaceProps) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"view" | "edit">("view");
  const [title, setTitle] = React.useState(proposal.title);
  const [layout, setLayout] = React.useState<ProposalLayout>(proposal.layout);
  const [content, setContent] = React.useState<ProposalContent>(proposal.content);
  const [saving, setSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const dirty = title !== proposal.title || layout !== proposal.layout || JSON.stringify(content) !== JSON.stringify(proposal.content);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProposal(proposal.id, { title, layout, content });
      toast.success("Proposal saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save proposal");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteProposal(proposal.id);
      toast.success("Proposal deleted");
      router.push(`/clients/${client.id}?tab=proposals`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete proposal");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Bonus support for manually printing via the browser (Ctrl/Cmd+P) —
          the real Download PDF path renders through the dedicated /print
          route instead, which is what guarantees pixel-accurate output. */}
      <style>{`@media print { @page { size: A4 ${layout === "DECK" ? "landscape" : "portrait"}; margin: 0; } }`}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/clients/${client.id}?tab=proposals`}
            className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> {client.companyName}
          </Link>
          {mode === "edit" ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 max-w-xs" />
          ) : (
            <span className="truncate text-sm font-medium">{title}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === "edit" && (
            <Select value={layout} onValueChange={(v) => setLayout(v as ProposalLayout)}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPOSAL_LAYOUTS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setMode(mode === "edit" ? "view" : "edit")}>
            {mode === "edit" ? (
              <>
                <Eye /> Preview
              </>
            ) : (
              <>
                <Pencil /> Edit
              </>
            )}
          </Button>

          {mode === "edit" && (
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
          </Button>

          <DownloadPdfButton proposalId={proposal.id} hasUnsavedChanges={dirty} />
        </div>
      </div>

      {mode === "edit" ? (
        <div className="grid flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-2">
          <div className="min-w-0">
            <SectionListEditor sections={content.sections} onChange={(sections) => setContent({ sections })} />
          </div>
          <div className="min-w-0 rounded-xl border border-border bg-muted/30 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <ProposalDocument client={client} layout={layout} content={content} mode="view" />
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <ProposalDocument client={client} layout={layout} content={content} mode="view" />
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this proposal?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes &ldquo;{title}&rdquo;. This can&rsquo;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:opacity-90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
