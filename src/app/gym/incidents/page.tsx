import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { IncidentList } from "./incident-list";

export default async function IncidentsPage() {
  const user = await requireGymUser();
  const canViewAll = can(user.accessRole as GymAccessRole, "viewAllIncidents");

  const incidents = await prisma.gymIncident.findMany({
    where: canViewAll ? undefined : { reportedById: user.id },
    orderBy: { occurredAt: "desc" },
    include: { reportedBy: { select: { id: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Incidents</h1>
        <p className="text-sm text-muted-foreground">
          {canViewAll ? "Health, safety and security incident log." : "Incidents you've reported."}
        </p>
      </div>
      <IncidentList
        incidents={incidents.map((i) => ({
          id: i.id,
          occurredAt: i.occurredAt,
          category: i.category,
          location: i.location,
          description: i.description,
          actionTaken: i.actionTaken,
          witnesses: i.witnesses,
          followUpRequired: i.followUpRequired,
          followUpNotes: i.followUpNotes,
          reportedBy: i.reportedBy,
        }))}
      />
    </div>
  );
}
