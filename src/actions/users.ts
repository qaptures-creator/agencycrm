"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createUser(data: { name: string; email: string; role?: string; color?: string }) {
  const user = await prisma.user.create({ data });
  revalidatePath("/settings");
  revalidatePath("/crm");
  return user;
}

export async function updateUser(id: string, data: { name?: string; email?: string; role?: string; color?: string }) {
  const user = await prisma.user.update({ where: { id }, data });
  revalidatePath("/settings");
  revalidatePath("/crm");
  return user;
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/crm");
}
