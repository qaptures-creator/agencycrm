"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { leadSchema, type GymLeadInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";

export async function createLeadAction(input: GymLeadInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = leadSchema.parse(input);

  const lead = await prisma.gymLead.create({ data });

  await logAudit({ userId: user.id, action: "LEAD_CREATED", entityType: "GymLead", entityId: lead.id });
  revalidatePath("/gym/leads");
  revalidatePath("/gym");
  return lead;
}

export async function updateLeadAction(id: string, input: GymLeadInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = leadSchema.parse(input);

  const lead = await prisma.gymLead.update({ where: { id }, data: { ...data, assignedToId: data.assignedToId || null } });

  await logAudit({ userId: user.id, action: "LEAD_UPDATED", entityType: "GymLead", entityId: id });
  revalidatePath("/gym/leads");
  return lead;
}

export async function moveLeadStageAction(id: string, stage: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const lead = await prisma.gymLead.update({
    where: { id },
    data: { stage, lastContactAt: new Date() },
  });

  await prisma.gymLeadActivity.create({
    data: { leadId: id, type: "STAGE_CHANGE", notes: `Moved to ${stage.replace(/_/g, " ")}`, createdById: user.id },
  });

  if (stage === "JOINED" && !lead.convertedMemberId) {
    const memberCount = await prisma.gymMember.count();
    const member = await prisma.gymMember.create({
      data: {
        memberNumber: `MM-${String(memberCount + 1).padStart(4, "0")}`,
        fullName: lead.name,
        email: lead.email,
        phone: lead.phone,
      },
    });
    await prisma.gymLead.update({ where: { id }, data: { convertedMemberId: member.id } });
  }

  await logAudit({ userId: user.id, action: "LEAD_STAGE_CHANGED", entityType: "GymLead", entityId: id, metadata: { stage } });
  revalidatePath("/gym/leads");
  revalidatePath("/gym/members");
  return lead;
}

export async function deleteLeadAction(id: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  await prisma.gymLead.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "LEAD_DELETED", entityType: "GymLead", entityId: id });
  revalidatePath("/gym/leads");
}

export async function addLeadActivityAction(id: string, type: string, notes: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  await prisma.gymLeadActivity.create({ data: { leadId: id, type, notes, createdById: user.id } });
  await prisma.gymLead.update({ where: { id }, data: { lastContactAt: new Date() } });

  await logAudit({ userId: user.id, action: "LEAD_ACTIVITY_ADDED", entityType: "GymLead", entityId: id });
  revalidatePath("/gym/leads");
}
