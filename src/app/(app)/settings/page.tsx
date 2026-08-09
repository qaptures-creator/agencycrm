import { prisma } from "@/lib/prisma";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [stages, deliverableStatuses, users, services] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { leads: true } } } }),
    prisma.deliverableStatusOption.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { deliverables: true } } } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { leads: true, clients: true } } } }),
  ]);

  return <SettingsView stages={stages} deliverableStatuses={deliverableStatuses} users={users} services={services} />;
}
