"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { announcementSchema, type AnnouncementInput } from "@/lib/gym/validators";
import { assertPermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";

export async function createAnnouncementAction(input: AnnouncementInput) {
  // "manageStaff" is the closest existing permission for manager-level admin actions —
  // there's no dedicated announcements permission, and the brief says not to add one.
  const user = await assertPermission("manageStaff");
  const data = announcementSchema.parse(input);

  const announcement = await prisma.gymAnnouncement.create({
    data: { ...data, createdById: user.id },
  });

  // Staff should "see this when logging in" — create a notification for every active user.
  const activeUsers = await prisma.gymUser.findMany({ where: { active: true }, select: { id: true } });
  if (activeUsers.length > 0) {
    await prisma.gymNotification.createMany({
      data: activeUsers.map((u) => ({
        userId: u.id,
        type: "ANNOUNCEMENT",
        title: `New announcement: ${announcement.title}`,
        link: "/gym/communications",
      })),
    });
  }

  await logAudit({ userId: user.id, action: "ANNOUNCEMENT_CREATED", entityType: "GymAnnouncement", entityId: announcement.id });
  revalidatePath("/gym/communications");
  revalidatePath("/gym");
  revalidatePath("/gym", "layout");
  return announcement;
}

export async function deleteAnnouncementAction(id: string) {
  const user = await assertPermission("manageStaff");
  await prisma.gymAnnouncement.delete({ where: { id } });
  await logAudit({ userId: user.id, action: "ANNOUNCEMENT_DELETED", entityType: "GymAnnouncement", entityId: id });
  revalidatePath("/gym/communications");
  revalidatePath("/gym");
}

export async function togglePinAnnouncementAction(id: string, pinned: boolean) {
  const user = await assertPermission("manageStaff");
  await prisma.gymAnnouncement.update({ where: { id }, data: { pinned } });
  await logAudit({ userId: user.id, action: "ANNOUNCEMENT_PIN_TOGGLED", entityType: "GymAnnouncement", entityId: id, metadata: { pinned } });
  revalidatePath("/gym/communications");
  revalidatePath("/gym");
}
