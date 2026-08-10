"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { maintenanceTicketSchema, type MaintenanceTicketInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

export async function createMaintenanceTicketAction(input: MaintenanceTicketInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = maintenanceTicketSchema.parse(input);

  const ticket = await prisma.gymMaintenanceTicket.create({
    data: {
      issue: data.issue,
      area: data.area,
      equipmentId: data.equipmentId || undefined,
      priority: data.priority,
      assignedToId: data.assignedToId || undefined,
      photoUrl: data.photoUrl,
      reportedById: user.staff?.id ?? undefined,
    },
  });

  await notifyManagement({
    type: "MAINTENANCE_TICKET",
    title: `New maintenance ticket — ${data.issue}`,
    body: data.area ?? undefined,
    link: "/gym/maintenance",
  });

  await logAudit({ userId: user.id, action: "MAINTENANCE_TICKET_CREATED", entityType: "GymMaintenanceTicket", entityId: ticket.id });
  revalidatePath("/gym/maintenance");
  revalidatePath("/gym");
  return ticket;
}

export async function updateMaintenanceTicketAction(id: string, input: MaintenanceTicketInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = maintenanceTicketSchema.parse(input);

  const ticket = await prisma.gymMaintenanceTicket.update({
    where: { id },
    data: {
      issue: data.issue,
      area: data.area,
      equipmentId: data.equipmentId || null,
      priority: data.priority,
      assignedToId: data.assignedToId || null,
      photoUrl: data.photoUrl,
    },
  });

  await logAudit({ userId: user.id, action: "MAINTENANCE_TICKET_UPDATED", entityType: "GymMaintenanceTicket", entityId: id });
  revalidatePath("/gym/maintenance");
  return ticket;
}

export async function setMaintenanceStatusAction(id: string, status: string, resolutionNotes?: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const ticket = await prisma.gymMaintenanceTicket.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "FIXED" ? new Date() : null,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : undefined,
    },
  });

  await logAudit({
    userId: user.id,
    action: "MAINTENANCE_STATUS_CHANGED",
    entityType: "GymMaintenanceTicket",
    entityId: id,
    metadata: { status },
  });
  revalidatePath("/gym/maintenance");
  revalidatePath("/gym");
  return ticket;
}

export async function assignMaintenanceTicketAction(id: string, assignedToId: string | null) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  await prisma.gymMaintenanceTicket.update({ where: { id }, data: { assignedToId } });

  await logAudit({
    userId: user.id,
    action: "MAINTENANCE_ASSIGNED",
    entityType: "GymMaintenanceTicket",
    entityId: id,
    metadata: { assignedToId },
  });
  revalidatePath("/gym/maintenance");
}
