import { prisma } from "@/lib/prisma";
import { RetainersView } from "./retainers-view";

export const dynamic = "force-dynamic";

export default async function RetainersPage() {
  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { companyName: "asc" },
    include: { retainer: true },
  });

  return <RetainersView clients={clients} />;
}
