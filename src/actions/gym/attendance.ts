"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { startOfDay, endOfDay } from "date-fns";

async function getOwnStaffOrThrow() {
  const user = await getCurrentGymUser();
  if (!user?.staff) throw new Error("No staff profile linked to this account.");
  return { user, staff: user.staff };
}

export async function clockInAction() {
  const { user, staff } = await getOwnStaffOrThrow();
  const now = new Date();

  const todaysShift = await prisma.gymRotaShift.findFirst({
    where: { staffId: staff.id, date: { gte: startOfDay(now), lte: endOfDay(now) } },
    orderBy: { startTime: "asc" },
  });

  const open = await prisma.gymAttendance.findFirst({
    where: { staffId: staff.id, clockOutAt: null },
  });
  if (open) throw new Error("Already clocked in.");

  const attendance = await prisma.gymAttendance.create({
    data: { staffId: staff.id, clockInAt: now, shiftId: todaysShift?.id },
  });

  await logAudit({ userId: user.id, action: "CLOCK_IN", entityType: "GymAttendance", entityId: attendance.id });
  revalidatePath("/gym/rota");
  revalidatePath("/gym");
  return attendance;
}

export async function clockOutAction() {
  const { user, staff } = await getOwnStaffOrThrow();

  const open = await prisma.gymAttendance.findFirst({
    where: { staffId: staff.id, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!open) throw new Error("Not currently clocked in.");

  const attendance = await prisma.gymAttendance.update({
    where: { id: open.id },
    data: { clockOutAt: new Date() },
  });

  await logAudit({ userId: user.id, action: "CLOCK_OUT", entityType: "GymAttendance", entityId: attendance.id });
  revalidatePath("/gym/rota");
  revalidatePath("/gym");
  return attendance;
}

export async function getOwnAttendanceStatus() {
  const user = await getCurrentGymUser();
  if (!user?.staff) return null;

  const [open, todaysShift] = await Promise.all([
    prisma.gymAttendance.findFirst({ where: { staffId: user.staff.id, clockOutAt: null } }),
    prisma.gymRotaShift.findFirst({
      where: { staffId: user.staff.id, date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return { clockedIn: !!open, clockInAt: open?.clockInAt ?? null, todaysShift };
}
