"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Clapperboard, MapPin, Calendar as CalendarIcon, LayoutGrid, ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar } from "@/components/ui/avatar";
import { ProjectForm } from "./project-form";
import { PROJECT_STATUSES } from "@/lib/constants";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { Client, Project, User } from "@prisma/client";

type ProjectWithMeta = Project & {
  client: Client;
  videographer: User | null;
  photographer: User | null;
  editor: User | null;
  _count: { deliverables: number };
};

export function ProjectsView({
  projects,
  clients,
  users,
}: {
  projects: ProjectWithMeta[];
  clients: Client[];
  users: User[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState("");
  const [clientFilter, setClientFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectWithMeta | null>(null);

  React.useEffect(() => {
    const projectId = searchParams.get("project");
    if (projectId) {
      const p = projects.find((pr) => pr.id === projectId);
      if (p) {
        setEditing(p);
        setDialogOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: ProjectWithMeta) {
    setEditing(p);
    setDialogOpen(true);
  }
  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditing(null);
      if (searchParams.get("project")) router.replace("/projects");
    }
  }

  const filtered = projects.filter((p) => {
    if (clientFilter !== "all" && p.clientId !== clientFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!`${p.name} ${p.client.companyName}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} project{projects.length === 1 ? "" : "s"} across all clients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/calendar">
              <CalendarIcon /> Calendar
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus /> New project
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search projects…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={projects.length === 0 ? "No projects yet" : "No projects match your filters"}
          description={projects.length === 0 ? "Create a project for a client to schedule shoots and track deliverables." : "Try adjusting your search or filters."}
          action={projects.length === 0 ? <Button size="sm" onClick={openCreate}><Plus /> New project</Button> : undefined}
        />
      ) : (
        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board"><LayoutGrid /> Board</TabsTrigger>
            <TabsTrigger value="list"><ListIcon /> List</TabsTrigger>
          </TabsList>

          <TabsContent value="board">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
              {PROJECT_STATUSES.map((status) => {
                const items = filtered.filter((p) => p.status === status.value);
                if (items.length === 0) return null;
                return (
                  <div key={status.value} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-secondary/30 p-2.5">
                    <div className="flex items-center gap-1.5 px-1 pb-1">
                      <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                      <p className="text-sm font-semibold">{status.label}</p>
                      <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {items.length}
                      </span>
                    </div>
                    {items.map((p) => (
                      <Card
                        key={p.id}
                        className="cursor-pointer border-l-4 p-3 shadow-sm transition-shadow hover:shadow-md"
                        style={{ borderLeftColor: p.client.color }}
                        onClick={() => openEdit(p)}
                      >
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.client.color }} />
                          {p.client.companyName}
                        </p>
                        {p.shootDate && (
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarIcon className="size-3" /> {formatDate(p.shootDate)}
                          </p>
                        )}
                      </Card>
                    ))}
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
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Shoot Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Crew</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.client.color }} />
                          {p.client.companyName}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge list={PROJECT_STATUSES} value={p.status} /></TableCell>
                      <TableCell>{formatDate(p.shootDate)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.shootLocation ? (
                          <span className="flex items-center gap-1"><MapPin className="size-3" /> {p.shootLocation}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <span className={cn(p.deadline && p.status !== "DELIVERED" && isOverdue(p.deadline) && "font-medium text-destructive")}>
                          {formatDate(p.deadline)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex -space-x-1.5">
                          {[p.videographer, p.photographer, p.editor].filter(Boolean).map((u) => (
                            <PersonAvatar key={u!.id} name={u!.name} color={u!.color} className="size-6 ring-2 ring-background" />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={handleDialogChange} title={editing ? "Edit project" : "New project"}>
        <ProjectForm
          project={editing ?? undefined}
          clients={clients}
          users={users}
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
