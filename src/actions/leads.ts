"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { leadSchema, type LeadInput } from "@/lib/validators";

export async function createLead(input: LeadInput) {
  const data = leadSchema.parse(input);
  const maxOrder = await prisma.lead.aggregate({
    where: { stageId: data.stageId },
    _max: { order: true },
  });

  const lead = await prisma.lead.create({
    data: {
      companyName: data.companyName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      instagram: data.instagram,
      website: data.website,
      industry: data.industry,
      location: data.location,
      source: data.source,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
      lastContactedAt: data.lastContactedAt,
      nextFollowUpAt: data.nextFollowUpAt,
      assignedToId: data.assignedToId,
      stageId: data.stageId,
      order: (maxOrder._max.order ?? -1) + 1,
      services: { connect: data.serviceIds?.map((id) => ({ id })) },
    },
  });

  revalidatePath("/crm");
  revalidatePath("/");
  return lead;
}

export async function updateLead(id: string, input: LeadInput) {
  const data = leadSchema.parse(input);

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      companyName: data.companyName,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      instagram: data.instagram,
      website: data.website,
      industry: data.industry,
      location: data.location,
      source: data.source,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
      lastContactedAt: data.lastContactedAt,
      nextFollowUpAt: data.nextFollowUpAt,
      assignedToId: data.assignedToId || null,
      stageId: data.stageId,
      services: { set: data.serviceIds?.map((id) => ({ id })) ?? [] },
    },
  });

  revalidatePath("/crm");
  revalidatePath("/");
  return lead;
}

export async function deleteLead(id: string) {
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/crm");
  revalidatePath("/");
}

export async function moveLead(id: string, stageId: string, order: number) {
  await prisma.lead.update({ where: { id }, data: { stageId, order } });
  revalidatePath("/crm");
  revalidatePath("/");
}

/** Persist the full ordering of a stage's column after a drag operation. */
export async function reorderLeadsInStage(stageId: string, orderedLeadIds: string[]) {
  await prisma.$transaction(
    orderedLeadIds.map((id, index) =>
      prisma.lead.update({ where: { id }, data: { stageId, order: index } })
    )
  );
  revalidatePath("/crm");
}

export async function getServices() {
  return prisma.service.findMany({ orderBy: { name: "asc" } });
}

export async function createService(name: string) {
  const service = await prisma.service.upsert({
    where: { name },
    create: { name },
    update: {},
  });
  revalidatePath("/crm");
  revalidatePath("/clients");
  revalidatePath("/settings");
  return service;
}
