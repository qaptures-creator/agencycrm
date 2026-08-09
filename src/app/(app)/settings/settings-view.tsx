"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PipelineStagesPanel } from "./pipeline-stages-panel";
import { DeliverableStatusesPanel } from "./deliverable-statuses-panel";
import { TeamPanel } from "./team-panel";
import { ServicesPanel } from "./services-panel";
import type { PipelineStage, DeliverableStatusOption, User, Service } from "@prisma/client";

export function SettingsView({
  stages,
  deliverableStatuses,
  users,
  services,
}: {
  stages: (PipelineStage & { _count: { leads: number } })[];
  deliverableStatuses: (DeliverableStatusOption & { _count: { deliverables: number } })[];
  users: User[];
  services: (Service & { _count: { leads: number; clients: number } })[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your pipeline, statuses, team and services.</p>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Stages</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverable Statuses</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <PipelineStagesPanel stages={stages} />
        </TabsContent>
        <TabsContent value="deliverables">
          <DeliverableStatusesPanel statuses={deliverableStatuses} />
        </TabsContent>
        <TabsContent value="team">
          <TeamPanel users={users} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesPanel services={services} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
