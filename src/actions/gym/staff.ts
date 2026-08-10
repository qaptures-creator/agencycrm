"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { staffSchema, type StaffInput } from "@/lib/gym/validators";
import { requirePermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";

export async function createStaffAction(input: StaffInput) {
  const actor = await requirePermission("manageStaff");
  const data = staffSchema.parse(input);

  const staff = await prisma.gymStaff.create({ data });

  await logAudit({ userId: actor.id, action: "STAFF_CREATED", entityType: "GymStaff", entityId: staff.id });
  revalidatePath("/gym/staff");
  return staff;
}

export async function updateStaffAction(id: string, input: StaffInput) {
  const actor = await requirePermission("manageStaff");
  const data = staffSchema.parse(input);

  const staff = await prisma.gymStaff.update({ where: { id }, data });

  await logAudit({ userId: actor.id, action: "STAFF_UPDATED", entityType: "GymStaff", entityId: id });
  revalidatePath("/gym/staff");
  revalidatePath(`/gym/staff/${id}`);
  return staff;
}

export async function setStaffEmploymentStatusAction(id: string, status: string) {
  const actor = await requirePermission("manageStaff");
  await prisma.gymStaff.update({ where: { id }, data: { employmentStatus: status } });
  await logAudit({ userId: actor.id, action: "STAFF_STATUS_CHANGED", entityType: "GymStaff", entityId: id, metadata: { status } });
  revalidatePath("/gym/staff");
  revalidatePath(`/gym/staff/${id}`);
}
