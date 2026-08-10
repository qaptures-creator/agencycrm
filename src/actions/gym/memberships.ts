"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { membershipPlanSchema, type MembershipPlanInput } from "@/lib/gym/validators";
import { assertPermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";

// Membership *plan catalog* CRUD (GymMembershipPlan). Creating/changing an
// individual member's active GymMembership lives in src/actions/gym/members.ts
// (changeMembershipAction, freezeMembershipAction, etc.) since that's a
// member-detail-page workflow, not a catalog one.

export async function createPlanAction(input: MembershipPlanInput) {
  const user = await assertPermission("manageMemberships");
  const data = membershipPlanSchema.parse(input);

  const plan = await prisma.gymMembershipPlan.create({ data });

  await logAudit({ userId: user.id, action: "MEMBERSHIP_PLAN_CREATED", entityType: "GymMembershipPlan", entityId: plan.id });
  revalidatePath("/gym/memberships");
  return plan;
}

export async function updatePlanAction(id: string, input: MembershipPlanInput) {
  const user = await assertPermission("manageMemberships");
  const data = membershipPlanSchema.parse(input);

  const plan = await prisma.gymMembershipPlan.update({ where: { id }, data });

  await logAudit({ userId: user.id, action: "MEMBERSHIP_PLAN_UPDATED", entityType: "GymMembershipPlan", entityId: id });
  revalidatePath("/gym/memberships");
  return plan;
}

export async function setPlanActiveAction(id: string, active: boolean) {
  const user = await assertPermission("manageMemberships");
  await prisma.gymMembershipPlan.update({ where: { id }, data: { active } });
  await logAudit({
    userId: user.id,
    action: "MEMBERSHIP_PLAN_STATUS_CHANGED",
    entityType: "GymMembershipPlan",
    entityId: id,
    metadata: { active },
  });
  revalidatePath("/gym/memberships");
}

export type CsvImportResult = { created: number; membershipsCreated: number; skipped: number; errors: string[] };

/**
 * Temporary/manual administrative tool — NOT an Ashbourne sync. Parses a
 * simple comma-separated file (no quoted-comma support) and creates
 * GymMember + optionally GymMembership rows directly in this CRM's own
 * database. Expected header columns (case-insensitive, any order):
 * fullName, email, phone, joinDate, planName, billingAmount, paymentFrequency
 */
export async function importMembersCsvAction(csvText: string): Promise<CsvImportResult> {
  const user = await assertPermission("manageMemberships");

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const fullNameIdx = idx("fullname");
  if (fullNameIdx === -1) throw new Error('CSV must include a "fullName" column.');
  const emailIdx = idx("email");
  const phoneIdx = idx("phone");
  const joinDateIdx = idx("joindate");
  const planNameIdx = idx("planname");
  const billingAmountIdx = idx("billingamount");
  const paymentFrequencyIdx = idx("paymentfrequency");

  const plans = await prisma.gymMembershipPlan.findMany();
  const planByName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), p]));

  let created = 0;
  let membershipsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];
  let memberCount = await prisma.gymMember.count();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const fullName = cols[fullNameIdx];
    if (!fullName) {
      skipped++;
      errors.push(`Row ${i + 1}: missing fullName, skipped.`);
      continue;
    }

    memberCount += 1;
    const joinDateRaw = joinDateIdx >= 0 ? cols[joinDateIdx] : "";
    const joinDate = joinDateRaw ? new Date(joinDateRaw) : undefined;

    const member = await prisma.gymMember.create({
      data: {
        memberNumber: `MM-${String(memberCount).padStart(4, "0")}`,
        fullName,
        email: emailIdx >= 0 ? cols[emailIdx] || null : null,
        phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null,
        ...(joinDate && !Number.isNaN(joinDate.getTime()) ? { joinDate } : {}),
      },
    });
    created++;

    const planName = planNameIdx >= 0 ? cols[planNameIdx] : "";
    if (planName) {
      const plan = planByName.get(planName.trim().toLowerCase());
      if (plan) {
        const rawAmount = billingAmountIdx >= 0 ? Number(cols[billingAmountIdx]) : NaN;
        const billingAmount = Number.isFinite(rawAmount) ? rawAmount : plan.price;
        const paymentFrequency = (paymentFrequencyIdx >= 0 && cols[paymentFrequencyIdx]) || plan.billingFrequency;

        await prisma.gymMembership.create({
          data: {
            memberId: member.id,
            planId: plan.id,
            billingAmount,
            paymentFrequency,
          },
        });
        membershipsCreated++;
      } else {
        errors.push(`Row ${i + 1}: plan "${planName}" not found — member created without a membership.`);
      }
    }
  }

  await logAudit({
    userId: user.id,
    action: "MEMBERS_CSV_IMPORTED",
    entityType: "GymMember",
    metadata: { created, membershipsCreated, skipped },
  });
  revalidatePath("/gym/members");
  revalidatePath("/gym/memberships");
  revalidatePath("/gym");

  return { created, membershipsCreated, skipped, errors };
}
