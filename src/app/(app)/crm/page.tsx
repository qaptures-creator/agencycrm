import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { CrmView } from "./crm-view";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const [stages, users, services, currentUser] = await Promise.all([
    prisma.pipelineStage.findMany({
      orderBy: { order: "asc" },
      include: {
        leads: {
          orderBy: { order: "asc" },
          include: { assignedTo: true, services: true },
        },
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    getCurrentUser(),
  ]);

  return <CrmView stages={stages} users={users} services={services} currentUserId={currentUser.id} />;
}
