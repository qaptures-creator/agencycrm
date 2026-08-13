import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { format } from "date-fns";
import { CleaningDashboard } from "./cleaning-dashboard";

export default async function CleaningPage({ searchParams }: { searchParams: Promise<{ date?: string; new?: string }> }) {
  const user = await requireGymUser();
  const canManage = can(user.accessRole as GymAccessRole, "manageTasks");
  const { date } = await searchParams;

  const day = date ? new Date(date + "T00:00:00") : new Date();
  const dayIso = format(day, "yyyy-MM-dd");
  const dayStart = new Date(dayIso + "T00:00:00");
  const dayEnd = new Date(dayIso + "T23:59:59.999");

  const [allZones, tasks, staff] = await Promise.all([
    prisma.gymCleaningZone.findMany({ orderBy: { order: "asc" } }),
    prisma.gymCleaningTask.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      include: {
        zone: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
        completedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.gymStaff.findMany({ where: { employmentStatus: { not: "Former" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  const zones = allZones.filter((z) => z.active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Equipment Cleaning</h1>
        <p className="text-sm text-muted-foreground">
          Staff clean, send photo proof over WhatsApp, then a manager reviews and marks each task complete.
        </p>
      </div>

      <CleaningDashboard
        dateIso={dayIso}
        zones={zones.map((z) => ({ id: z.id, name: z.name }))}
        tasks={tasks.map((t) => ({
          id: t.id,
          date: t.date.toISOString(),
          whatBeingCleaned: t.whatBeingCleaned,
          status: t.status,
          notes: t.notes,
          photoUrl: t.photoUrl,
          completedAt: t.completedAt ? t.completedAt.toISOString() : null,
          zone: t.zone,
          assignedTo: t.assignedTo,
          completedBy: t.completedBy,
        }))}
        staff={staff}
        allZones={allZones.map((z) => ({ id: z.id, name: z.name, order: z.order, active: z.active }))}
        canManage={canManage}
      />
    </div>
  );
}
