import { prisma } from "@/lib/prisma";
import { ProjectsView } from "./projects-view";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, clients, users] = await Promise.all([
    prisma.project.findMany({
      orderBy: { shootDate: "desc" },
      include: {
        client: true,
        videographer: true,
        photographer: true,
        editor: true,
        _count: { select: { deliverables: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { companyName: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <ProjectsView projects={projects} clients={clients} users={users} />;
}
