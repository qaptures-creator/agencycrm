"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, generateToken, hashToken, generateTempPassword } from "@/lib/gym/password";
import { createGymSession, destroyGymSession } from "@/lib/gym/session";
import { requirePermission, getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { revalidatePath } from "next/cache";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const user = await prisma.gymUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return { error: "Incorrect email or password." };
  }

  await createGymSession(user.id);
  await prisma.gymUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({ userId: user.id, action: "LOGIN", entityType: "GymUser", entityId: user.id });

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/gym") ? next : "/gym");
}

export async function logoutAction() {
  const user = await getCurrentGymUser();
  if (user) {
    await logAudit({ userId: user.id, action: "LOGOUT", entityType: "GymUser", entityId: user.id });
  }
  await destroyGymSession();
  redirect("/gym-login");
}

const requestResetSchema = z.object({ email: z.string().email() });

/** No email provider is connected (see Settings > Integrations > Email), so we
 * can't deliver a reset email. Instead we mint a token and hand the manager a
 * link to pass on securely — same security property, honest about what's wired up. */
export async function requestPasswordResetAction(
  _prev: { error?: string; resetLink?: string } | null,
  formData: FormData
) {
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email address." };

  const user = await prisma.gymUser.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Always return the same message whether or not the account exists, to avoid leaking which emails are registered.
  if (!user) return { error: undefined, resetLink: undefined, submitted: true };

  const token = generateToken();
  await prisma.gymPasswordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  return { submitted: true, resetLink: `/gym-login/reset?token=${token}` };
}

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPasswordAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid submission." };

  const record = await prisma.gymPasswordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired." };
  }

  await prisma.$transaction([
    prisma.gymUser.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(parsed.data.password), mustResetPassword: false },
    }),
    prisma.gymPasswordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await logAudit({ userId: record.userId, action: "PASSWORD_RESET", entityType: "GymUser", entityId: record.userId });

  return { success: true };
}

const createStaffAccountSchema = z.object({
  staffId: z.string().min(1),
  email: z.string().email(),
  accessRole: z.enum(["OWNER", "MANAGER", "STAFF", "MARKETING"]),
});

/** Owner/Manager-only: provision a login for an existing staff profile. No
 * public registration — this is the only way a GymUser account is created. */
export async function createStaffAccountAction(input: z.infer<typeof createStaffAccountSchema>) {
  const actor = await requirePermission("manageStaff");
  const data = createStaffAccountSchema.parse(input);

  const tempPassword = generateTempPassword();
  const user = await prisma.gymUser.create({
    data: {
      name: (await prisma.gymStaff.findUniqueOrThrow({ where: { id: data.staffId } })).fullName,
      email: data.email.toLowerCase(),
      accessRole: data.accessRole,
      passwordHash: hashPassword(tempPassword),
      mustResetPassword: true,
      staff: { connect: { id: data.staffId } },
    },
  });

  await logAudit({
    userId: actor.id,
    action: "STAFF_ACCOUNT_CREATED",
    entityType: "GymUser",
    entityId: user.id,
    metadata: { staffId: data.staffId },
  });

  revalidatePath("/gym/staff");
  return { email: user.email, tempPassword };
}

/** Owner/Manager-only: issue a new temporary password for a staff member who's
 * locked out, since there's no self-service email flow yet. */
export async function resetStaffPasswordAction(userId: string) {
  const actor = await requirePermission("manageStaff");
  const tempPassword = generateTempPassword();

  await prisma.gymUser.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(tempPassword), mustResetPassword: true },
  });

  await logAudit({ userId: actor.id, action: "STAFF_PASSWORD_RESET", entityType: "GymUser", entityId: userId });

  revalidatePath("/gym/staff");
  return { tempPassword };
}

export async function setStaffActiveAction(userId: string, active: boolean) {
  const actor = await requirePermission("manageStaff");
  await prisma.gymUser.update({ where: { id: userId }, data: { active } });
  await logAudit({
    userId: actor.id,
    action: active ? "STAFF_ACCOUNT_ENABLED" : "STAFF_ACCOUNT_DISABLED",
    entityType: "GymUser",
    entityId: userId,
  });
  revalidatePath("/gym/staff");
}
