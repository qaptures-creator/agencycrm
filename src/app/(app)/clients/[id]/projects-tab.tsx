"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Clapperboard, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { StatusBadge } from "@/components/status-badge";
import { PersonAvatar } from "@/components/ui/avatar";
import { ProjectForm } from "@/app/(app)/projects/project-form";
import { PROJECT_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Client, Project, User } from "@prisma/client";

type ProjectWithCrew = Project & {
  videographer: User | null;
  photographer: User | null;
  editor: User | null;
  _count: { deliverables: number };
};

export function ProjectsTab({
  client,
  projects,
  users,
}: {
  client: Client;
  projects: ProjectWithCrew[];
  users: User[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectWithCrew | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: ProjectWithCrew) {
    setEditing(p);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects.length} project{projects.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={Clapperboard} title="No projects yet" description="Create the first project or shoot for this client." />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card key={p.id} className="cursor-pointer p-4 transition-shadow hover:shadow-md" onClick={() => openEdit(p)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {p.shootDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> {formatDate(p.shootDate)} {p.shootTime}
                      </span>
                    )}
                    {p.shootLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> {p.shootLocation}
                      </span>
                    )}
                    <span>{p._count.deliverables} deliverable{p._count.deliverables === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <StatusBadge list={PROJECT_STATUSES} value={p.status} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                {[p.videographer, p.photographer, p.editor].filter(Boolean).map((u) => (
                  <div key={u!.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PersonAvatar name={u!.name} color={u!.color} className="size-5" />
                    {u!.name}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit project" : "New project"}
      >
        <ProjectForm
          project={editing ?? undefined}
          clients={[client]}
          users={users}
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
