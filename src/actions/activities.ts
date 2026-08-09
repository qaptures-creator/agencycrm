"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { activitySchema, type ActivityInput } from "@/lib/validators";

export async function createActivity(input: ActivityInput) {
  const data = activitySchema.parse(input);

  const activity = await prisma.activity.create({
    data: {
      type: data.type,
      subject: data.subject,
      notes: data.notes,
      dueAt: data.dueAt,
      completedAt: data.completedAt,
      leadId: data.leadId,
      clientId: data.clientId,
      createdById: data.createdById,
    },
  });

  if (data.leadId) {
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { lastContactedAt: new Date(), nextFollowUpAt: data.dueAt ?? undefined },
    });
  }

  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/");
  return activity;
}

export async function completeActivity(id: string) {
  await prisma.activity.update({ where: { id }, data: { completedAt: new Date() } });
  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/");
}

export async function deleteActivity(id: string) {
  await prisma.activity.delete({ where: { id } });
  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/");
}
