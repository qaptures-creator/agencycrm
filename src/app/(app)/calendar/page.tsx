import { prisma } from "@/lib/prisma";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [projects, deliverables] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ shootDate: { not: null } }, { deadline: { not: null } }] },
      include: { client: true },
    }),
    prisma.deliverable.findMany({
      where: { deadline: { not: null } },
      include: { client: true, status: true },
    }),
  ]);

  return <CalendarView projects={projects} deliverables={deliverables} />;
}
