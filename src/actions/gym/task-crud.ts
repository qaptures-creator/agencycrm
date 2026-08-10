"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { taskSchema, type TaskInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyUser } from "@/lib/gym/notify";

export async function createTaskAction(input: TaskInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = taskSchema.parse(input);

  const task = await prisma.gymTask.create({
    data: { ...data, createdById: user.id },
    include: { assignedTo: { include: { user: true } } },
  });

  if (task.assignedTo?.user && task.assignedTo.user.id !== user.id) {
    await notifyUser({
      userId: task.assignedTo.user.id,
      type: "TASK_ASSIGNED",
      title: `New task: ${task.title}`,
      link: "/gym/tasks",
    });
  }

  await logAudit({ userId: user.id, action: "TASK_CREATED", entityType: "GymTask", entityId: task.id });
  revalidatePath("/gym/tasks");
  revalidatePath("/gym");
  return task;
}

export async function updateTaskAction(id: string, input: TaskInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = taskSchema.parse(input);

  const task = await prisma.gymTask.update({ where: { id }, data });

  await logAudit({ userId: user.id, action: "TASK_UPDATED", entityType: "GymTask", entityId: id });
  revalidatePath("/gym/tasks");
  revalidatePath("/gym");
  return task;
}

export async function deleteTaskAction(id: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  await prisma.gymTask.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "TASK_DELETED", entityType: "GymTask", entityId: id });
  revalidatePath("/gym/tasks");
  revalidatePath("/gym");
}

export async function setTaskStatusAction(id: string, status: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  await prisma.gymTask.update({
    where: { id },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
  });
  await logAudit({ userId: user.id, action: "TASK_STATUS_CHANGED", entityType: "GymTask", entityId: id, metadata: { status } });
  revalidatePath("/gym/tasks");
  revalidatePath("/gym");
}
