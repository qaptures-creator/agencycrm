"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";

export async function toggleTaskCompleteAction(taskId: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const task = await prisma.gymTask.findUniqueOrThrow({ where: { id: taskId } });
  const completing = task.status !== "COMPLETED";

  await prisma.gymTask.update({
    where: { id: taskId },
    data: {
      status: completing ? "COMPLETED" : "TODO",
      completedAt: completing ? new Date() : null,
    },
  });

  await logAudit({
    userId: user.id,
    action: completing ? "TASK_COMPLETED" : "TASK_REOPENED",
    entityType: "GymTask",
    entityId: taskId,
  });

  revalidatePath("/gym");
  revalidatePath("/gym/tasks");
}
