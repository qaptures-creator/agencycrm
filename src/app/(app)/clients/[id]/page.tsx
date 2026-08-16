import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getMicrosoftConnectionStatus } from "@/actions/microsoft";
import { ClientProfileView } from "./client-profile-view";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [client, users, deliverableStatuses, currentUser, microsoftStatus] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        services: true,
        fromLead: { include: { stage: true } },
        projects: {
          orderBy: { shootDate: "desc" },
          include: { videographer: true, photographer: true, editor: true, _count: { select: { deliverables: true } } },
        },
        deliverables: {
          orderBy: { createdAt: "desc" },
          include: { status: true, assignedEditor: true, project: true },
        },
        invoices: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
        retainer: true,
        documents: { orderBy: { uploadedAt: "desc" } },
        proposals: { orderBy: { updatedAt: "desc" } },
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.deliverableStatusOption.findMany({ orderBy: { order: "asc" } }),
    getCurrentUser(),
    getMicrosoftConnectionStatus(),
  ]);

  if (!client) notFound();

  return (
    <ClientProfileView
      client={client}
      users={users}
      deliverableStatuses={deliverableStatuses}
      currentUserId={currentUser.id}
      microsoftConnected={microsoftStatus.connected}
    />
  );
}
