"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { retainerSchema, type RetainerInput } from "@/lib/validators";

function toData(data: ReturnType<typeof retainerSchema.parse>) {
  return {
    monthlyRetainer: data.monthlyRetainer ?? 0,
    shootsIncluded: data.shootsIncluded ?? 0,
    videosIncluded: data.videosIncluded ?? 0,
    photosIncluded: data.photosIncluded ?? 0,
    shootsUsed: data.shootsUsed ?? 0,
    videosUsed: data.videosUsed ?? 0,
    photosUsed: data.photosUsed ?? 0,
    nextShootDate: data.nextShootDate,
    nextPaymentDate: data.nextPaymentDate,
    renewalDate: data.renewalDate,
    servicesIncludedText: data.servicesIncludedText,
  };
}

export async function upsertRetainer(input: RetainerInput) {
  const data = retainerSchema.parse(input);
  const retainer = await prisma.retainer.upsert({
    where: { clientId: data.clientId },
    create: { clientId: data.clientId, ...toData(data) },
    update: toData(data),
  });
  revalidatePath("/retainers");
  revalidatePath(`/clients/${data.clientId}`);
  revalidatePath("/");
  return retainer;
}

export async function deleteRetainer(clientId: string) {
  await prisma.retainer.delete({ where: { clientId } }).catch(() => null);
  revalidatePath("/retainers");
  revalidatePath(`/clients/${clientId}`);
}

export async function incrementRetainerUsage(
  clientId: string,
  field: "shootsUsed" | "videosUsed" | "photosUsed",
  delta = 1
) {
  const retainer = await prisma.retainer.update({
    where: { clientId },
    data: { [field]: { increment: delta } },
  });
  revalidatePath("/retainers");
  revalidatePath(`/clients/${clientId}`);
  return retainer;
}
