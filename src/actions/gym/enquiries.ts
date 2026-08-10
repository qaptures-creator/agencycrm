"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { enquirySchema, type EnquiryInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

export async function createEnquiryAction(input: EnquiryInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = enquirySchema.parse(input);

  const enquiry = await prisma.gymEnquiry.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      source: data.source,
      assignedToId: data.assignedToId,
      followUpAt: data.followUpAt,
      messages: data.message
        ? { create: { direction: "INBOUND", body: data.message, fromEmail: data.email } }
        : undefined,
    },
  });

  await notifyManagement({
    type: "NEW_ENQUIRY",
    title: `New enquiry — ${enquiry.name}`,
    body: enquiry.subject ?? undefined,
    link: `/gym/enquiries?enquiry=${enquiry.id}`,
  });

  await logAudit({ userId: user.id, action: "ENQUIRY_CREATED", entityType: "GymEnquiry", entityId: enquiry.id });
  revalidatePath("/gym/enquiries");
  revalidatePath("/gym");
  return enquiry;
}

export async function updateEnquiryAction(id: string, input: EnquiryInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  const data = enquirySchema.parse(input);

  const enquiry = await prisma.gymEnquiry.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      assignedToId: data.assignedToId || null,
      followUpAt: data.followUpAt,
    },
  });

  await logAudit({ userId: user.id, action: "ENQUIRY_UPDATED", entityType: "GymEnquiry", entityId: id });
  revalidatePath("/gym/enquiries");
  return enquiry;
}

export async function setEnquiryStatusAction(id: string, status: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  await prisma.gymEnquiry.update({ where: { id }, data: { status } });
  await logAudit({ userId: user.id, action: "ENQUIRY_STATUS_CHANGED", entityType: "GymEnquiry", entityId: id, metadata: { status } });
  revalidatePath("/gym/enquiries");
  revalidatePath("/gym");
}

export async function assignEnquiryAction(id: string, staffId: string | null) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  await prisma.gymEnquiry.update({ where: { id }, data: { assignedToId: staffId } });
  await logAudit({ userId: user.id, action: "ENQUIRY_ASSIGNED", entityType: "GymEnquiry", entityId: id, metadata: { staffId } });
  revalidatePath("/gym/enquiries");
}

export async function addEnquiryNoteAction(id: string, body: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (!body.trim()) throw new Error("Note cannot be empty");

  await prisma.gymEnquiryMessage.create({
    data: { enquiryId: id, direction: "INTERNAL_NOTE", body, authorId: user.id },
  });

  await logAudit({ userId: user.id, action: "ENQUIRY_NOTE_ADDED", entityType: "GymEnquiry", entityId: id });
  revalidatePath("/gym/enquiries");
}

export async function scheduleFollowUpAction(id: string, followUpAt: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  await prisma.gymEnquiry.update({
    where: { id },
    data: { followUpAt: new Date(followUpAt), status: "FOLLOW_UP" },
  });
  await logAudit({ userId: user.id, action: "ENQUIRY_FOLLOWUP_SCHEDULED", entityType: "GymEnquiry", entityId: id });
  revalidatePath("/gym/enquiries");
}

export async function convertEnquiryToLeadAction(id: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const enquiry = await prisma.gymEnquiry.findUniqueOrThrow({ where: { id } });
  if (enquiry.convertedMemberId) throw new Error("Already converted.");

  const sourceMap: Record<string, string> = { EMAIL: "EMAIL", WEBSITE: "WEBSITE", PHONE: "PHONE", WALK_IN: "WALK_IN" };

  const lead = await prisma.gymLead.create({
    data: {
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      source: sourceMap[enquiry.source] ?? "OTHER",
      assignedToId: enquiry.assignedToId,
      fromEnquiryId: enquiry.id,
    },
  });

  await prisma.gymEnquiry.update({ where: { id }, data: { status: "CONVERTED" } });

  await logAudit({ userId: user.id, action: "ENQUIRY_CONVERTED_TO_LEAD", entityType: "GymEnquiry", entityId: id, metadata: { leadId: lead.id } });
  revalidatePath("/gym/enquiries");
  revalidatePath("/gym/leads");
  return lead;
}

export async function convertEnquiryToMemberAction(id: string) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const enquiry = await prisma.gymEnquiry.findUniqueOrThrow({ where: { id } });

  const memberCount = await prisma.gymMember.count();
  const member = await prisma.gymMember.create({
    data: {
      memberNumber: `MM-${String(memberCount + 1).padStart(4, "0")}`,
      fullName: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
    },
  });

  await prisma.gymEnquiry.update({ where: { id }, data: { status: "CONVERTED", convertedMemberId: member.id } });

  await logAudit({ userId: user.id, action: "ENQUIRY_CONVERTED_TO_MEMBER", entityType: "GymEnquiry", entityId: id, metadata: { memberId: member.id } });
  revalidatePath("/gym/enquiries");
  revalidatePath("/gym/members");
  return member;
}
