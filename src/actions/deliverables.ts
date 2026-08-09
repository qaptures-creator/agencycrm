"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deliverableSchema, type DeliverableInput } from "@/lib/validators";
import { DEFAULT_DELIVERABLE_STATUSES } from "@/lib/constants";

function toData(data: ReturnType<typeof deliverableSchema.parse>) {
  return {
    clientId: data.clientId,
    projectId: data.projectId || null,
    contentType: data.contentType,
    customTypeName: data.customTypeName,
    assignedEditorId: data.assignedEditorId || null,
    statusId: data.statusId,
    deadline: data.deadline,
    revisionCount: data.revisionCount ?? 0,
    approvalStatus: data.approvalStatus,
    deliveryLink: data.deliveryLink,
    notes: data.notes,
  };
}

function revalidateAll(clientId: string) {
  revalidatePath("/deliverables");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}

export async function createDeliverable(input: DeliverableInput) {
  const data = deliverableSchema.parse(input);
  const deliverable = await prisma.deliverable.create({ data: toData(data) });
  revalidateAll(data.clientId);
  return deliverable;
}

export async function updateDeliverable(id: string, input: DeliverableInput) {
  const data = deliverableSchema.parse(input);
  const deliverable = await prisma.deliverable.update({ where: { id }, data: toData(data) });
  revalidateAll(data.clientId);
  return deliverable;
}

export async function updateDeliverableStatus(id: string, statusId: string) {
  const deliverable = await prisma.deliverable.update({ where: { id }, data: { statusId } });
  revalidateAll(deliverable.clientId);
  return deliverable;
}

export async function deleteDeliverable(id: string) {
  const deliverable = await prisma.deliverable.delete({ where: { id } });
  revalidateAll(deliverable.clientId);
}

export async function getDeliverableStatuses() {
  return prisma.deliverableStatusOption.findMany({ orderBy: { order: "asc" } });
}

export async function createDeliverableStatus(name: string, color = "#6366f1") {
  const maxOrder = await prisma.deliverableStatusOption.aggregate({ _max: { order: true } });
  const status = await prisma.deliverableStatusOption.create({
    data: { name, color, order: (maxOrder._max.order ?? -1) + 1 },
  });
  revalidatePath("/deliverables");
  revalidatePath("/settings");
  return status;
}

export async function updateDeliverableStatusOption(
  id: string,
  data: { name?: string; color?: string; isTerminal?: boolean }
) {
  const status = await prisma.deliverableStatusOption.update({ where: { id }, data });
  revalidatePath("/deliverables");
  revalidatePath("/settings");
  return status;
}

export async function deleteDeliverableStatus(id: string, fallbackStatusId?: string) {
  const count = await prisma.deliverable.count({ where: { statusId: id } });
  if (count > 0) {
    if (!fallbackStatusId) {
      throw new Error(`This status is used by ${count} deliverable(s). Choose a status to move them to first.`);
    }
    await prisma.deliverable.updateMany({ where: { statusId: id }, data: { statusId: fallbackStatusId } });
  }
  await prisma.deliverableStatusOption.delete({ where: { id } });
  revalidatePath("/deliverables");
  revalidatePath("/settings");
}

export async function reorderDeliverableStatuses(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.deliverableStatusOption.update({ where: { id }, data: { order: index } }))
  );
  revalidatePath("/deliverables");
  revalidatePath("/settings");
}

export async function ensureDefaultDeliverableStatuses() {
  const count = await prisma.deliverableStatusOption.count();
  if (count === 0) {
    for (let i = 0; i < DEFAULT_DELIVERABLE_STATUSES.length; i++) {
      await prisma.deliverableStatusOption.create({ data: { ...DEFAULT_DELIVERABLE_STATUSES[i], order: i } });
    }
  }
}
