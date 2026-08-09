import { prisma } from "@/lib/prisma";
import { ensureDefaultDeliverableStatuses } from "@/actions/deliverables";
import { DeliverablesView } from "./deliverables-view";

export const dynamic = "force-dynamic";

export default async function DeliverablesPage() {
  await ensureDefaultDeliverableStatuses();

  const [deliverables, clients, projects, users, statuses] = await Promise.all([
    prisma.deliverable.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, project: true, status: true, assignedEditor: true },
    }),
    prisma.client.findMany({ orderBy: { companyName: "asc" } }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.deliverableStatusOption.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <DeliverablesView
      deliverables={deliverables}
      clients={clients}
      projects={projects}
      users={users}
      statuses={statuses}
    />
  );
}
