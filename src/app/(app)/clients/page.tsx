import { prisma } from "@/lib/prisma";
import { ClientsView } from "./clients-view";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [clients, services] = await Promise.all([
    prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        services: true,
        _count: { select: { projects: true, deliverables: true, invoices: true } },
        retainer: true,
      },
    }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <ClientsView clients={clients} services={services} />;
}
