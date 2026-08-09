"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Mail, Phone, Globe, AtSign, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { EntityDialog } from "@/components/entity-dialog";
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
import { ClientForm } from "../client-form";
import { OverviewTab } from "./overview-tab";
import { ProjectsTab } from "./projects-tab";
import { DeliverablesTab } from "./deliverables-tab";
import { RetainerTab } from "./retainer-tab";
import { InvoicesTab } from "./invoices-tab";
import { ActivityLog } from "@/components/activity-log";
import { CLIENT_STATUSES } from "@/lib/constants";
import { deleteClient } from "@/actions/clients";
import type { ServiceOption } from "@/components/services-select";
import type {
  Client,
  Service,
  Lead,
  PipelineStage,
  Project,
  User,
  Deliverable,
  DeliverableStatusOption,
  Invoice,
  Activity,
  Retainer,
} from "@prisma/client";

type FullClient = Client & {
  services: Service[];
  fromLead: (Lead & { stage: PipelineStage }) | null;
  projects: (Project & { videographer: User | null; photographer: User | null; editor: User | null; _count: { deliverables: number } })[];
  deliverables: (Deliverable & { status: DeliverableStatusOption; assignedEditor: User | null; project: Project | null })[];
  invoices: Invoice[];
  activities: (Activity & { createdBy: User | null })[];
  retainer: Retainer | null;
};

export function ClientProfileView({
  client,
  users,
  deliverableStatuses,
  currentUserId,
}: {
  client: FullClient;
  users: User[];
  deliverableStatuses: DeliverableStatusOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  async function handleDelete() {
    try {
      await deleteClient(client.id);
      toast.success("Client deleted");
      router.push("/clients");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete client");
    }
  }

  const services: ServiceOption[] = client.services;

  return (
    <div className="space-y-5">
      <Link href="/clients" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All clients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.companyName}</h1>
            <StatusBadge list={CLIENT_STATUSES} value={client.status} />
          </div>
          <p className="text-sm text-muted-foreground">{client.mainContactName}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3" /> {client.email}
              </a>
            )}
            {client.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3" /> {client.phone}
              </span>
            )}
            {client.instagram && (
              <span className="flex items-center gap-1">
                <AtSign className="size-3" /> {client.instagram}
              </span>
            )}
            {client.website && (
              <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                <Globe className="size-3" /> {client.website}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects ({client.projects.length})</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables ({client.deliverables.length})</TabsTrigger>
          <TabsTrigger value="retainer">Retainer</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({client.invoices.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({client.activities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab client={client} />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectsTab client={client} projects={client.projects} users={users} />
        </TabsContent>
        <TabsContent value="deliverables">
          <DeliverablesTab
            client={client}
            deliverables={client.deliverables}
            projects={client.projects}
            users={users}
            statuses={deliverableStatuses}
          />
        </TabsContent>
        <TabsContent value="retainer">
          <RetainerTab client={client} retainer={client.retainer} />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab client={client} invoices={client.invoices} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityLog
            activities={client.activities}
            clientId={client.id}
            currentUserId={currentUserId}
            onChanged={() => router.refresh()}
          />
        </TabsContent>
      </Tabs>

      <EntityDialog open={editOpen} onOpenChange={setEditOpen} title="Edit client">
        <ClientForm
          client={client}
          services={services}
          onSuccess={() => {
            setEditOpen(false);
            router.refresh();
          }}
          onCancel={() => setEditOpen(false)}
        />
      </EntityDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {client.companyName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the client along with their projects, deliverables, invoices and activity history. This can&rsquo;t be undone.
            </AlertDialogDescription>
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
