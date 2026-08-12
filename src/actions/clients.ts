"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clientSchema, type ClientInput } from "@/lib/validators";

export async function createClient(input: ClientInput) {
  const data = clientSchema.parse(input);
  const client = await prisma.client.create({
    data: {
      companyName: data.companyName,
      mainContactName: data.mainContactName,
      email: data.email,
      phone: data.phone,
      instagram: data.instagram,
      website: data.website,
      monthlyRetainer: data.monthlyRetainer,
      contractStart: data.contractStart,
      contractEnd: data.contractEnd,
      paymentStatus: data.paymentStatus,
      status: data.status,
      color: data.color,
      notes: data.notes,
      services: { connect: data.serviceIds?.map((id) => ({ id })) },
    },
  });
  revalidatePath("/clients");
  revalidatePath("/");
  return client;
}

export async function updateClient(id: string, input: ClientInput) {
  const data = clientSchema.parse(input);
  const client = await prisma.client.update({
    where: { id },
    data: {
      companyName: data.companyName,
      mainContactName: data.mainContactName,
      email: data.email,
      phone: data.phone,
      instagram: data.instagram,
      website: data.website,
      monthlyRetainer: data.monthlyRetainer,
      contractStart: data.contractStart,
      contractEnd: data.contractEnd,
      paymentStatus: data.paymentStatus,
      status: data.status,
      color: data.color,
      notes: data.notes,
      services: { set: data.serviceIds?.map((id) => ({ id })) ?? [] },
    },
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");
  return client;
}

export async function deleteClient(id: string) {
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  revalidatePath("/");
}

/** Convert a Won lead into a full Client record, preserving lead history. */
export async function convertLeadToClient(leadId: string, input: ClientInput) {
  const data = clientSchema.parse(input);

  const existing = await prisma.client.findUnique({ where: { fromLeadId: leadId } });
  if (existing) return existing;

  const client = await prisma.client.create({
    data: {
      companyName: data.companyName,
      mainContactName: data.mainContactName,
      email: data.email,
      phone: data.phone,
      instagram: data.instagram,
      website: data.website,
      monthlyRetainer: data.monthlyRetainer,
      contractStart: data.contractStart,
      contractEnd: data.contractEnd,
      paymentStatus: data.paymentStatus,
      status: data.status,
      color: data.color,
      notes: data.notes,
      fromLeadId: leadId,
      services: { connect: data.serviceIds?.map((id) => ({ id })) },
    },
  });

  const wonStage = await prisma.pipelineStage.findFirst({ where: { isWon: true } });
  if (wonStage) {
    await prisma.lead.update({ where: { id: leadId }, data: { stageId: wonStage.id } });
  }

  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/");
  return client;
}
