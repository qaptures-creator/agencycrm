import "server-only";
import { prisma } from "@/lib/prisma";

/** Create an in-app notification for a single user. Used by other modules to
 * surface: new enquiry, lead follow-up due, task assigned/overdue, rota
 * published/changed, equipment fault, maintenance assignment, failed payment,
 * membership cancellation. */
export async function notifyUser(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  await prisma.gymNotification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    },
  });
}

/** Notify every active Owner/Manager — used for things that need management attention. */
export async function notifyManagement(params: { type: string; title: string; body?: string; link?: string }) {
  const managers = await prisma.gymUser.findMany({
    where: { active: true, accessRole: { in: ["OWNER", "MANAGER"] } },
    select: { id: true },
  });
  await prisma.gymNotification.createMany({
    data: managers.map((m) => ({ userId: m.id, ...params })),
  });
}
