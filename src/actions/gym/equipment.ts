"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { equipmentSchema, type EquipmentInput, maintenanceTicketSchema } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

export async function createEquipmentAction(input: EquipmentInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = equipmentSchema.parse(input);

  const equipment = await prisma.gymEquipment.create({ data });

  await logAudit({ userId: user.id, action: "EQUIPMENT_CREATED", entityType: "GymEquipment", entityId: equipment.id });
  revalidatePath("/gym/equipment");
  return equipment;
}

export async function updateEquipmentAction(id: string, input: EquipmentInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = equipmentSchema.parse(input);

  const equipment = await prisma.gymEquipment.update({ where: { id }, data });

  await logAudit({ userId: user.id, action: "EQUIPMENT_UPDATED", entityType: "GymEquipment", entityId: id });
  revalidatePath("/gym/equipment");
  return equipment;
}

/** "Report Issue" quick action on an equipment row — creates a linked maintenance ticket. */
export async function reportEquipmentIssueAction(equipmentId: string, input: { issue: string; priority?: string }) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const equipment = await prisma.gymEquipment.findUniqueOrThrow({ where: { id: equipmentId } });

  const data = maintenanceTicketSchema.parse({
    issue: input.issue,
    priority: input.priority ?? "NORMAL",
    equipmentId,
  });

  const ticket = await prisma.gymMaintenanceTicket.create({
    data: {
      issue: data.issue,
      area: data.area,
      priority: data.priority,
      equipmentId,
      reportedById: user.staff?.id ?? undefined,
    },
  });

  await notifyManagement({
    type: "EQUIPMENT_FAULT",
    title: `Equipment issue reported — ${equipment.name}`,
    body: data.issue,
    link: "/gym/maintenance",
  });

  await logAudit({
    userId: user.id,
    action: "EQUIPMENT_ISSUE_REPORTED",
    entityType: "GymEquipment",
    entityId: equipmentId,
    metadata: { ticketId: ticket.id },
  });
  revalidatePath("/gym/equipment");
  revalidatePath("/gym/maintenance");
  revalidatePath("/gym");
  return ticket;
}
