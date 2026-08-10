"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { shiftSchema, type ShiftInput } from "@/lib/gym/validators";
import { requirePermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyUser } from "@/lib/gym/notify";
import { addDays, startOfWeek, endOfWeek } from "date-fns";

function combineDateTime(dateStr: string, timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}

export async function createShiftAction(input: ShiftInput) {
  const actor = await requirePermission("manageRota");
  const data = shiftSchema.parse(input);

  const shift = await prisma.gymRotaShift.create({
    data: {
      staffId: data.staffId,
      date: new Date(data.date + "T00:00:00"),
      startTime: combineDateTime(data.date, data.startTime),
      endTime: combineDateTime(data.date, data.endTime),
      breakMinutes: data.breakMinutes ?? 0,
      shiftRole: data.shiftRole,
      notes: data.notes,
    },
    include: { staff: { include: { user: true } } },
  });

  if (shift.staff.user) {
    await notifyUser({
      userId: shift.staff.user.id,
      type: "ROTA_SHIFT_ADDED",
      title: "New shift added to your rota",
      body: `${data.date} · ${data.startTime}–${data.endTime}`,
      link: "/gym/rota",
    });
  }

  await logAudit({ userId: actor.id, action: "SHIFT_CREATED", entityType: "GymRotaShift", entityId: shift.id });
  revalidatePath("/gym/rota");
  revalidatePath("/gym");
  return shift;
}

export async function updateShiftAction(id: string, input: ShiftInput) {
  const actor = await requirePermission("manageRota");
  const data = shiftSchema.parse(input);

  const shift = await prisma.gymRotaShift.update({
    where: { id },
    data: {
      staffId: data.staffId,
      date: new Date(data.date + "T00:00:00"),
      startTime: combineDateTime(data.date, data.startTime),
      endTime: combineDateTime(data.date, data.endTime),
      breakMinutes: data.breakMinutes ?? 0,
      shiftRole: data.shiftRole,
      notes: data.notes,
    },
  });

  await logAudit({ userId: actor.id, action: "SHIFT_UPDATED", entityType: "GymRotaShift", entityId: id });
  revalidatePath("/gym/rota");
  revalidatePath("/gym");
  return shift;
}

export async function deleteShiftAction(id: string) {
  const actor = await requirePermission("manageRota");
  await prisma.gymRotaShift.delete({ where: { id } });
  await logAudit({ userId: actor.id, action: "SHIFT_DELETED", entityType: "GymRotaShift", entityId: id });
  revalidatePath("/gym/rota");
  revalidatePath("/gym");
}

export async function duplicateShiftToDateAction(id: string, newDate: string) {
  const actor = await requirePermission("manageRota");
  const original = await prisma.gymRotaShift.findUniqueOrThrow({ where: { id } });

  const startH = original.startTime.getHours();
  const startM = original.startTime.getMinutes();
  const endH = original.endTime.getHours();
  const endM = original.endTime.getMinutes();

  const date = new Date(newDate + "T00:00:00");
  const startTime = new Date(date);
  startTime.setHours(startH, startM, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(endH, endM, 0, 0);

  const shift = await prisma.gymRotaShift.create({
    data: {
      staffId: original.staffId,
      date,
      startTime,
      endTime,
      breakMinutes: original.breakMinutes,
      shiftRole: original.shiftRole,
      notes: original.notes,
    },
  });

  await logAudit({ userId: actor.id, action: "SHIFT_DUPLICATED", entityType: "GymRotaShift", entityId: shift.id });
  revalidatePath("/gym/rota");
  return shift;
}

/** Copy every shift from the previous week into the given week (by its Monday). */
export async function duplicateLastWeekAction(weekStartIso: string) {
  const actor = await requirePermission("manageRota");
  const weekStart = new Date(weekStartIso + "T00:00:00");
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(weekStart, -1);

  const prevShifts = await prisma.gymRotaShift.findMany({
    where: { date: { gte: startOfWeek(prevWeekStart, { weekStartsOn: 1 }), lte: endOfWeek(prevWeekEnd, { weekStartsOn: 1 }) } },
  });

  await prisma.$transaction(
    prevShifts.map((s) => {
      const newDate = addDays(s.date, 7);
      const dayOffset = newDate.getTime() - s.date.getTime();
      return prisma.gymRotaShift.create({
        data: {
          staffId: s.staffId,
          date: newDate,
          startTime: new Date(s.startTime.getTime() + dayOffset),
          endTime: new Date(s.endTime.getTime() + dayOffset),
          breakMinutes: s.breakMinutes,
          shiftRole: s.shiftRole,
          notes: s.notes,
        },
      });
    })
  );

  await logAudit({ userId: actor.id, action: "ROTA_WEEK_DUPLICATED", entityType: "GymRotaShift", metadata: { weekStartIso } });
  revalidatePath("/gym/rota");
  return prevShifts.length;
}

export async function publishWeekAction(weekStartIso: string) {
  const actor = await requirePermission("manageRota");
  const weekStart = new Date(weekStartIso + "T00:00:00");
  const weekEnd = addDays(weekStart, 6);

  const shifts = await prisma.gymRotaShift.findMany({
    where: { date: { gte: weekStart, lte: weekEnd }, published: false },
    include: { staff: { include: { user: true } } },
  });

  await prisma.gymRotaShift.updateMany({
    where: { id: { in: shifts.map((s) => s.id) } },
    data: { published: true },
  });

  const notifiedUserIds = new Set<string>();
  for (const s of shifts) {
    if (s.staff.user && !notifiedUserIds.has(s.staff.user.id)) {
      notifiedUserIds.add(s.staff.user.id);
      await notifyUser({
        userId: s.staff.user.id,
        type: "ROTA_PUBLISHED",
        title: "This week's rota has been published",
        link: "/gym/rota",
      });
    }
  }

  await logAudit({ userId: actor.id, action: "ROTA_PUBLISHED", entityType: "GymRotaShift", metadata: { weekStartIso, count: shifts.length } });
  revalidatePath("/gym/rota");
  return shifts.length;
}
