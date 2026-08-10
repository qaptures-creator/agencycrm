"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentGymUser } from "@/lib/gym/auth";

export async function markNotificationReadAction(id: string) {
  const user = await getCurrentGymUser();
  if (!user) return;
  await prisma.gymNotification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
  revalidatePath("/gym", "layout");
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentGymUser();
  if (!user) return;
  await prisma.gymNotification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/gym", "layout");
}
