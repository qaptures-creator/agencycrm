"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageCheck, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { DotBadge, Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar } from "@/components/ui/avatar";
import { DeliverableForm } from "@/app/(app)/deliverables/deliverable-form";
import { DELIVERABLE_CONTENT_TYPES, APPROVAL_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, cn, isOverdue } from "@/lib/utils";
import type { Client, Deliverable, DeliverableStatusOption, User, Project } from "@prisma/client";

type DeliverableWithMeta = Deliverable & {
  status: DeliverableStatusOption;
  assignedEditor: User | null;
  project: Project | null;
};

export function DeliverablesTab({
  client,
  deliverables,
  projects,
  users,
  statuses,
}: {
  client: Client;
  deliverables: DeliverableWithMeta[];
  projects: Project[];
  users: User[];
  statuses: DeliverableStatusOption[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DeliverableWithMeta | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(d: DeliverableWithMeta) {
    setEditing(d);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{deliverables.length} deliverable{deliverables.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus /> New deliverable
        </Button>
      </div>

      {deliverables.length === 0 ? (
        <EmptyState icon={PackageCheck} title="No deliverables yet" description="Track reels, videos, photos and other content here." />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Editor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Revisions</TableHead>
                <TableHead>Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverables.map((d) => {
                const overdue = d.deadline && !d.status.isTerminal && isOverdue(d.deadline);
                return (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => openEdit(d)}>
                    <TableCell className="font-medium">
                      {d.contentType === "OTHER" ? d.customTypeName || "Other" : labelFor(DELIVERABLE_CONTENT_TYPES, d.contentType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.project?.name || "—"}</TableCell>
                    <TableCell>
                      {d.assignedEditor ? (
                        <div className="flex items-center gap-1.5">
                          <PersonAvatar name={d.assignedEditor.name} color={d.assignedEditor.color} className="size-5" />
                          <span className="text-xs">{d.assignedEditor.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DotBadge color={d.status.color}>{d.status.name}</DotBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge list={APPROVAL_STATUSES} value={d.approvalStatus} />
                    </TableCell>
                    <TableCell>
                      <span className={cn(overdue && "font-medium text-destructive")}>{formatDate(d.deadline)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{d.revisionCount}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {d.deliveryLink ? (
                        <a href={d.deliveryLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Link2 className="size-3.5" /> Open
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit deliverable" : "New deliverable"}>
        <DeliverableForm
          deliverable={editing ?? undefined}
          clients={[client]}
          projects={projects}
          users={users}
          statuses={statuses}
          defaultClientId={client.id}
          onSuccess={() => {
            setDialogOpen(false);
            router.refresh();
          }}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
