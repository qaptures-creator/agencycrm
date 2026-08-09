"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, PackageCheck, Link2, LayoutGrid, ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { StatusBadge } from "@/components/status-badge";
import { DotBadge, Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/components/ui/avatar";
import { DeliverableForm } from "./deliverable-form";
import { DELIVERABLE_CONTENT_TYPES, APPROVAL_STATUSES, labelFor } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { Client, Project, User, Deliverable, DeliverableStatusOption } from "@prisma/client";

type DeliverableWithMeta = Deliverable & {
  client: Client;
  project: Project | null;
  status: DeliverableStatusOption;
  assignedEditor: User | null;
};

export function DeliverablesView({
  deliverables,
  clients,
  projects,
  users,
  statuses,
}: {
  deliverables: DeliverableWithMeta[];
  clients: Client[];
  projects: Project[];
  users: User[];
  statuses: DeliverableStatusOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState("");
  const [clientFilter, setClientFilter] = React.useState("all");
  const [editorFilter, setEditorFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DeliverableWithMeta | null>(null);

  React.useEffect(() => {
    const id = searchParams.get("deliverable");
    if (id) {
      const d = deliverables.find((x) => x.id === id);
      if (d) {
        setEditing(d);
        setDialogOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(d: DeliverableWithMeta) {
    setEditing(d);
    setDialogOpen(true);
  }
  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditing(null);
      if (searchParams.get("deliverable")) router.replace("/deliverables");
    }
  }

  const filtered = deliverables.filter((d) => {
    if (clientFilter !== "all" && d.clientId !== clientFilter) return false;
    if (editorFilter !== "all" && d.assignedEditorId !== editorFilter) return false;
    if (statusFilter !== "all" && d.statusId !== statusFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const label = d.contentType === "OTHER" ? d.customTypeName || "" : labelFor(DELIVERABLE_CONTENT_TYPES, d.contentType);
      if (!`${label} ${d.client.companyName}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const dueSoon = deliverables.filter((d) => !d.status.isTerminal && d.deadline && isOverdue(d.deadline)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Deliverables</h1>
          <p className="text-sm text-muted-foreground">
            {deliverables.length} total {dueSoon > 0 && <span className="font-medium text-destructive">· {dueSoon} overdue</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> New deliverable
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search deliverables…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={editorFilter} onValueChange={setEditorFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Editor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All editors</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title={deliverables.length === 0 ? "No deliverables yet" : "No deliverables match your filters"}
          description={deliverables.length === 0 ? "Track reels, videos, photos and other content for your clients." : "Try adjusting your search or filters."}
          action={deliverables.length === 0 ? <Button size="sm" onClick={openCreate}><Plus /> New deliverable</Button> : undefined}
        />
      ) : (
        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board"><LayoutGrid /> Board</TabsTrigger>
            <TabsTrigger value="list"><ListIcon /> List</TabsTrigger>
          </TabsList>

          <TabsContent value="board">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
              {statuses.map((status) => {
                const items = filtered.filter((d) => d.statusId === status.id);
                if (items.length === 0) return null;
                return (
                  <div key={status.id} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-secondary/30 p-2.5">
                    <div className="flex items-center gap-1.5 px-1 pb-1">
                      <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                      <p className="text-sm font-semibold">{status.name}</p>
                      <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {items.length}
                      </span>
                    </div>
                    {items.map((d) => {
                      const overdue = d.deadline && !d.status.isTerminal && isOverdue(d.deadline);
                      return (
                        <Card key={d.id} className="cursor-pointer p-3 shadow-sm transition-shadow hover:shadow-md" onClick={() => openEdit(d)}>
                          <p className="truncate text-sm font-medium">
                            {d.contentType === "OTHER" ? d.customTypeName || "Other" : labelFor(DELIVERABLE_CONTENT_TYPES, d.contentType)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{d.client.companyName}</p>
                          <div className="mt-2 flex items-center justify-between">
                            {d.deadline ? (
                              <span className={cn("text-[11px]", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                                {formatDate(d.deadline)}
                              </span>
                            ) : <span />}
                            {d.assignedEditor && <PersonAvatar name={d.assignedEditor.name} color={d.assignedEditor.color} className="size-5" />}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="list">
            <div className="rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Client</TableHead>
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
                  {filtered.map((d) => {
                    const overdue = d.deadline && !d.status.isTerminal && isOverdue(d.deadline);
                    return (
                      <TableRow key={d.id} className="cursor-pointer" onClick={() => openEdit(d)}>
                        <TableCell className="font-medium">
                          {d.contentType === "OTHER" ? d.customTypeName || "Other" : labelFor(DELIVERABLE_CONTENT_TYPES, d.contentType)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{d.client.companyName}</TableCell>
                        <TableCell className="text-muted-foreground">{d.project?.name || "—"}</TableCell>
                        <TableCell>
                          {d.assignedEditor ? (
                            <div className="flex items-center gap-1.5">
                              <PersonAvatar name={d.assignedEditor.name} color={d.assignedEditor.color} className="size-5" />
                              <span className="text-xs">{d.assignedEditor.name}</span>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><DotBadge color={d.status.color}>{d.status.name}</DotBadge></TableCell>
                        <TableCell><StatusBadge list={APPROVAL_STATUSES} value={d.approvalStatus} /></TableCell>
                        <TableCell>
                          <span className={cn(overdue && "font-medium text-destructive")}>{formatDate(d.deadline)}</span>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{d.revisionCount}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {d.deliveryLink ? (
                            <a href={d.deliveryLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Link2 className="size-3.5" /> Open
                            </a>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={handleDialogChange} title={editing ? "Edit deliverable" : "New deliverable"}>
        <DeliverableForm
          deliverable={editing ?? undefined}
          clients={clients}
          projects={projects}
          users={users}
          statuses={statuses}
          onSuccess={() => {
            handleDialogChange(false);
            router.refresh();
          }}
          onCancel={() => handleDialogChange(false)}
        />
      </EntityDialog>
    </div>
  );
}
