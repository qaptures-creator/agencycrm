"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { incidentSchema, type IncidentInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

export async function createIncidentAction(input: IncidentInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = incidentSchema.parse(input);

  const incident = await prisma.gymIncident.create({
    data: {
      occurredAt: new Date(data.occurredAt),
      category: data.category,
      location: data.location,
      description: data.description,
      actionTaken: data.actionTaken,
      witnesses: data.witnesses,
      followUpRequired: data.followUpRequired,
      followUpNotes: data.followUpNotes,
      reportedById: user.id,
    },
  });

  await notifyManagement({
    type: "INCIDENT_REPORTED",
    title: `Incident reported — ${data.category.replace(/_/g, " ")}`,
    body: data.description,
    link: "/gym/incidents",
  });

  await logAudit({ userId: user.id, action: "INCIDENT_CREATED", entityType: "GymIncident", entityId: incident.id });
  revalidatePath("/gym/incidents");
  revalidatePath("/gym");
  return incident;
}

/** Incidents are an append-only audit trail — only follow-up fields may be edited, never the incident itself, and it can never be deleted. */
export async function updateIncidentFollowUpAction(id: string, input: { followUpRequired: boolean; followUpNotes?: string }) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const incident = await prisma.gymIncident.update({
    where: { id },
    data: {
      followUpRequired: input.followUpRequired,
      followUpNotes: input.followUpNotes && input.followUpNotes.trim().length > 0 ? input.followUpNotes : undefined,
    },
  });

  await logAudit({ userId: user.id, action: "INCIDENT_FOLLOWUP_UPDATED", entityType: "GymIncident", entityId: id });
  revalidatePath("/gym/incidents");
  revalidatePath("/gym");
  return incident;
}
