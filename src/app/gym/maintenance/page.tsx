import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { MaintenanceBoard } from "./maintenance-board";

export default async function MaintenancePage() {
  await requireGymUser();

  const [tickets, staff, equipment] = await Promise.all([
    prisma.gymMaintenanceTicket.findMany({
      orderBy: { reportedAt: "desc" },
      include: {
        equipment: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    }),
    prisma.gymStaff.findMany({ where: { employmentStatus: { not: "Former" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.gymEquipment.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Maintenance</h1>
        <p className="text-sm text-muted-foreground">Faults and repairs, from report through to fix.</p>
      </div>
      <MaintenanceBoard
        tickets={tickets.map((t) => ({
          id: t.id,
          issue: t.issue,
          area: t.area,
          priority: t.priority,
          status: t.status,
          reportedAt: t.reportedAt,
          resolutionNotes: t.resolutionNotes,
          resolvedAt: t.resolvedAt,
          equipment: t.equipment,
          reportedBy: t.reportedBy,
          assignedTo: t.assignedTo,
        }))}
        staff={staff}
        equipment={equipment}
      />
    </div>
  );
}
