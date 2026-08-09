"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function revalidateAll() {
  revalidatePath("/settings");
  revalidatePath("/crm");
  revalidatePath("/clients");
}

export async function renameService(id: string, name: string) {
  const service = await prisma.service.update({ where: { id }, data: { name } });
  revalidateAll();
  return service;
}

export async function deleteService(id: string) {
  await prisma.service.delete({ where: { id } });
  revalidateAll();
}
