"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileStack, Plus, Presentation, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProposal } from "@/actions/proposals";
import { PROPOSAL_LAYOUTS, type ProposalLayout } from "@/lib/proposal-types";
import { formatDateTime } from "@/lib/utils";
import type { Client, Proposal } from "@prisma/client";

export function ProposalsTab({ client, proposals }: { client: Client; proposals: Proposal[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(`Proposal for ${client.companyName}`);
  const [layout, setLayout] = React.useState<ProposalLayout>("DOCUMENT");
  const [creating, setCreating] = React.useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const proposal = await createProposal({ clientId: client.id, title, layout });
      toast.success("Proposal created");
      setOpen(false);
      router.push(`/proposals/${proposal.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create proposal");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {proposals.length} proposal{proposals.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> New proposal
        </Button>
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="No proposals yet"
          description="Build a branded proposal for this client and export it as a polished PDF."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> New proposal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <Link key={proposal.id} href={`/proposals/${proposal.id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium">{proposal.title}</p>
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    {proposal.layout === "DECK" ? <Presentation className="size-3" /> : <FileText className="size-3" />}
                    {proposal.layout === "DECK" ? "Deck" : "Doc"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Updated {formatDateTime(proposal.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <EntityDialog open={open} onOpenChange={setOpen} title="New proposal">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proposal-title">Title</Label>
            <Input id="proposal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Layout</Label>
            <Select value={layout} onValueChange={(v) => setLayout(v as ProposalLayout)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROPOSAL_LAYOUTS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title.trim() || creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </EntityDialog>
    </div>
  );
}
