"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cleaningTaskSchema, cleaningZoneSchema, type CleaningTaskInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

function toDateOnly(value: string) {
  return new Date(value + "T00:00:00");
}

export async function createCleaningTaskAction(input: CleaningTaskInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = cleaningTaskSchema.parse(input);

  const task = await prisma.gymCleaningTask.create({
    data: {
      date: toDateOnly(data.date),
      zoneId: data.zoneId,
      whatBeingCleaned: data.whatBeingCleaned,
      assignedToId: data.assignedToId || undefined,
      notes: data.notes,
      photoUrl: data.photoUrl,
      status: data.status,
      createdById: user.id,
    },
  });

  await logAudit({ userId: user.id, action: "CLEANING_TASK_CREATED", entityType: "GymCleaningTask", entityId: task.id });
  revalidatePath("/gym/cleaning");
  revalidatePath("/gym/cleaning/weekly");
  return task;
}

export async function updateCleaningTaskAction(id: string, input: CleaningTaskInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = cleaningTaskSchema.parse(input);

  const task = await prisma.gymCleaningTask.update({
    where: { id },
    data: {
      date: toDateOnly(data.date),
      zoneId: data.zoneId,
      whatBeingCleaned: data.whatBeingCleaned,
      assignedToId: data.assignedToId || null,
      notes: data.notes,
      photoUrl: data.photoUrl,
    },
  });

  await logAudit({ userId: user.id, action: "CLEANING_TASK_UPDATED", entityType: "GymCleaningTask", entityId: id });
  revalidatePath("/gym/cleaning");
  revalidatePath("/gym/cleaning/weekly");
  return task;
}

/** Generic status setter used by both the quick-change dropdown and the
 * dedicated "Mark Complete" button. Moving a task into or out of COMPLETE is
 * an approval action and is restricted to managers/owners (manageTasks). */
export async function setCleaningTaskStatusAction(id: string, status: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const existing = await prisma.gymCleaningTask.findUniqueOrThrow({ where: { id } });
  const touchesApproval = status === "COMPLETE" || existing.status === "COMPLETE";
  if (touchesApproval && !can(user.accessRole as GymAccessRole, "manageTasks")) {
    throw new Error("Only a manager can mark cleaning tasks complete");
  }
  if (existing.status === status) return existing;

  const task = await prisma.gymCleaningTask.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETE" ? new Date() : null,
      completedById: status === "COMPLETE" ? user.id : null,
    },
  });

  await logAudit({
    userId: user.id,
    action: "CLEANING_TASK_STATUS_CHANGED",
    entityType: "GymCleaningTask",
    entityId: id,
    metadata: { from: existing.status, to: status },
  });

  if (status === "AWAITING_REVIEW") {
    await notifyManagement({
      type: "CLEANING_AWAITING_REVIEW",
      title: `Cleaning ready for review — ${task.whatBeingCleaned}`,
      link: "/gym/cleaning",
    });
  }

  revalidatePath("/gym/cleaning");
  revalidatePath("/gym/cleaning/weekly");
  return task;
}

export async function attachCleaningPhotoAction(id: string, photoUrl: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const task = await prisma.gymCleaningTask.update({ where: { id }, data: { photoUrl } });
  await logAudit({ userId: user.id, action: "CLEANING_PHOTO_ATTACHED", entityType: "GymCleaningTask", entityId: id });
  revalidatePath("/gym/cleaning");
  return task;
}

export async function deleteCleaningTaskAction(id: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!can(user.accessRole as GymAccessRole, "manageTasks")) {
    throw new Error("You do not have permission to delete cleaning tasks");
  }

  await prisma.gymCleaningTask.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "CLEANING_TASK_DELETED", entityType: "GymCleaningTask", entityId: id });
  revalidatePath("/gym/cleaning");
  revalidatePath("/gym/cleaning/weekly");
}

export async function getCleaningTaskAuditAction(taskId: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  return prisma.gymAuditLog.findMany({
    where: { entityType: "GymCleaningTask", entityId: taskId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
    take: 30,
  });
}

// ---------------------------------------------------------------------------
// Zone catalog — configurable list, managed by owners/managers
// ---------------------------------------------------------------------------

export async function createCleaningZoneAction(name: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!can(user.accessRole as GymAccessRole, "manageTasks")) {
    throw new Error("You do not have permission to manage cleaning zones");
  }
  const data = cleaningZoneSchema.parse({ name });

  const count = await prisma.gymCleaningZone.count();
  const zone = await prisma.gymCleaningZone.create({ data: { name: data.name, order: count } });

  await logAudit({ userId: user.id, action: "CLEANING_ZONE_CREATED", entityType: "GymCleaningZone", entityId: zone.id });
  revalidatePath("/gym/cleaning");
  return zone;
}

export async function updateCleaningZoneAction(id: string, input: { name?: string; active?: boolean }) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!can(user.accessRole as GymAccessRole, "manageTasks")) {
    throw new Error("You do not have permission to manage cleaning zones");
  }

  const data: { name?: string; active?: boolean } = {};
  if (input.name !== undefined) data.name = cleaningZoneSchema.parse({ name: input.name }).name;
  if (input.active !== undefined) data.active = input.active;

  const zone = await prisma.gymCleaningZone.update({ where: { id }, data });
  await logAudit({ userId: user.id, action: "CLEANING_ZONE_UPDATED", entityType: "GymCleaningZone", entityId: id, metadata: data });
  revalidatePath("/gym/cleaning");
  return zone;
}

export async function deleteCleaningZoneAction(id: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!can(user.accessRole as GymAccessRole, "manageTasks")) {
    throw new Error("You do not have permission to manage cleaning zones");
  }

  const taskCount = await prisma.gymCleaningTask.count({ where: { zoneId: id } });
  if (taskCount > 0) {
    throw new Error("This zone has cleaning tasks logged against it — deactivate it instead of deleting");
  }

  await prisma.gymCleaningZone.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "CLEANING_ZONE_DELETED", entityType: "GymCleaningZone", entityId: id });
  revalidatePath("/gym/cleaning");
}

export async function reorderCleaningZonesAction(orderedIds: string[]) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!can(user.accessRole as GymAccessRole, "manageTasks")) {
    throw new Error("You do not have permission to manage cleaning zones");
  }

  await prisma.$transaction(orderedIds.map((id, i) => prisma.gymCleaningZone.update({ where: { id }, data: { order: i } })));
  revalidatePath("/gym/cleaning");
}
