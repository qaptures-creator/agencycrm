import { prisma } from "@/lib/prisma";
import { getMicrosoftConnectionStatus } from "@/actions/microsoft";
import { isMicrosoftConfigured } from "@/lib/microsoft-auth";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [stages, deliverableStatuses, users, services, microsoftStatus] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { leads: true } } } }),
    prisma.deliverableStatusOption.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { deliverables: true } } } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { leads: true, clients: true } } } }),
    getMicrosoftConnectionStatus(),
  ]);

  return (
    <SettingsView
      stages={stages}
      deliverableStatuses={deliverableStatuses}
      users={users}
      services={services}
      microsoftStatus={microsoftStatus}
      microsoftConfigured={isMicrosoftConfigured()}
    />
  );
}
