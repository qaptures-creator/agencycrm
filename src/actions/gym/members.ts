"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { memberSchema, type MemberInput, membershipSchema, type MembershipInput } from "@/lib/gym/validators";
import { requireGymUser, assertPermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";
import { geocodeMember } from "@/lib/gym/member-geocoding";

/** Best-effort: geocoding must never fail a member save. A few seconds of
 * extra latency on this low-frequency, deliberate staff action is an
 * acceptable trade for the map staying in sync without a separate sync
 * step — see src/lib/gym/member-geocoding.ts for the full pipeline. */
async function geocodeMemberBestEffort(memberId: string) {
  try {
    await geocodeMember(memberId);
  } catch {
    // Swallowed deliberately — geocodeMember already records geocodeStatus
    // on the member row for anything geocode-able; this only guards
    // against something (e.g. a DB hiccup) throwing before that happens.
  }
}

export async function createMemberAction(input: MemberInput) {
  const user = await requireGymUser();
  const data = memberSchema.parse(input);

  const memberCount = await prisma.gymMember.count();
  const member = await prisma.gymMember.create({
    data: {
      memberNumber: `MM-${String(memberCount + 1).padStart(4, "0")}`,
      ...data,
    },
  });

  if (member.address) await geocodeMemberBestEffort(member.id);

  await logAudit({ userId: user.id, action: "MEMBER_CREATED", entityType: "GymMember", entityId: member.id });
  revalidatePath("/gym/members");
  revalidatePath("/gym");
  return member;
}

export async function updateMemberAction(id: string, input: MemberInput) {
  const user = await requireGymUser();
  const data = memberSchema.parse(input);

  const existing = await prisma.gymMember.findUniqueOrThrow({ where: { id }, select: { address: true } });
  const member = await prisma.gymMember.update({ where: { id }, data });

  if (member.address && member.address !== existing.address) await geocodeMemberBestEffort(member.id);

  await logAudit({ userId: user.id, action: "MEMBER_UPDATED", entityType: "GymMember", entityId: id });
  revalidatePath("/gym/members");
  revalidatePath(`/gym/members/${id}`);
  return member;
}

export async function addMemberNoteAction(memberId: string, body: string) {
  const user = await requireGymUser();
  if (!body.trim()) throw new Error("Note cannot be empty");

  const note = await prisma.gymMemberNote.create({
    data: { memberId, body, authorId: user.id },
  });

  await logAudit({ userId: user.id, action: "MEMBER_NOTE_ADDED", entityType: "GymMember", entityId: memberId });
  revalidatePath(`/gym/members/${memberId}`);
  return note;
}

/** Create a new GymMembership for a member, superseding whatever membership
 * is currently their most recent one (if any). This only ever touches this
 * CRM's own database — it never claims to talk to Ashbourne or any payment
 * processor. */
export async function changeMembershipAction(input: MembershipInput) {
  const user = await assertPermission("manageMemberships");
  const data = membershipSchema.parse(input);

  const current = await prisma.gymMembership.findFirst({
    where: { memberId: data.memberId, status: { in: ["ACTIVE", "FROZEN", "OVERDUE"] } },
    orderBy: { startDate: "desc" },
  });

  if (current) {
    await prisma.gymMembership.update({
      where: { id: current.id },
      data: { status: "EXPIRED" },
    });
    await prisma.gymMembershipEvent.create({
      data: {
        membershipId: current.id,
        type: "UPDATED",
        notes: "Superseded by a new membership plan",
        createdById: user.id,
      },
    });
  }

  const membership = await prisma.gymMembership.create({
    data: {
      memberId: data.memberId,
      planId: data.planId,
      startDate: data.startDate ?? new Date(),
      renewalDate: data.renewalDate,
      billingAmount: data.billingAmount,
      paymentFrequency: data.paymentFrequency,
      status: data.status,
      paymentStatus: data.paymentStatus,
    },
  });

  await prisma.gymMembershipEvent.create({
    data: {
      membershipId: membership.id,
      type: current ? "RENEWED" : "JOINED",
      notes: current ? "Membership plan changed" : "Membership created",
      createdById: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: current ? "MEMBERSHIP_CHANGED" : "MEMBERSHIP_CREATED",
    entityType: "GymMembership",
    entityId: membership.id,
    metadata: { memberId: data.memberId, planId: data.planId },
  });
  revalidatePath("/gym/members");
  revalidatePath(`/gym/members/${data.memberId}`);
  revalidatePath("/gym/memberships");
  revalidatePath("/gym");
  return membership;
}

export async function freezeMembershipAction(membershipId: string, notes?: string) {
  const user = await assertPermission("manageMemberships");

  const membership = await prisma.gymMembership.update({
    where: { id: membershipId },
    data: { status: "FROZEN", freezeStart: new Date(), freezeEnd: null },
  });
  await prisma.gymMembershipEvent.create({
    data: { membershipId, type: "FROZEN", notes: notes || null, createdById: user.id },
  });

  await logAudit({ userId: user.id, action: "MEMBERSHIP_FROZEN", entityType: "GymMembership", entityId: membershipId });
  revalidatePath("/gym/members");
  revalidatePath(`/gym/members/${membership.memberId}`);
  revalidatePath("/gym");
  return membership;
}

export async function unfreezeMembershipAction(membershipId: string, notes?: string) {
  const user = await assertPermission("manageMemberships");

  const membership = await prisma.gymMembership.update({
    where: { id: membershipId },
    data: { status: "ACTIVE", freezeEnd: new Date() },
  });
  await prisma.gymMembershipEvent.create({
    data: { membershipId, type: "UNFROZEN", notes: notes || null, createdById: user.id },
  });

  await logAudit({ userId: user.id, action: "MEMBERSHIP_UNFROZEN", entityType: "GymMembership", entityId: membershipId });
  revalidatePath("/gym/members");
  revalidatePath(`/gym/members/${membership.memberId}`);
  revalidatePath("/gym");
  return membership;
}

export async function cancelMembershipAction(membershipId: string, notes?: string) {
  const user = await assertPermission("manageMemberships");

  const membership = await prisma.gymMembership.update({
    where: { id: membershipId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: { member: true },
  });
  await prisma.gymMembershipEvent.create({
    data: { membershipId, type: "CANCELLED", notes: notes || null, createdById: user.id },
  });

  await notifyManagement({
    type: "MEMBERSHIP_CANCELLED",
    title: `Membership cancelled — ${membership.member.fullName}`,
    body: notes || undefined,
    link: `/gym/members/${membership.memberId}`,
  });

  await logAudit({ userId: user.id, action: "MEMBERSHIP_CANCELLED", entityType: "GymMembership", entityId: membershipId });
  revalidatePath("/gym/members");
  revalidatePath(`/gym/members/${membership.memberId}`);
  revalidatePath("/gym");
  return membership;
}
