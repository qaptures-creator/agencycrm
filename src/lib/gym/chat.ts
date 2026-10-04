import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * One shared, team-wide chat room — no DMs/channels (see the session's
 * design decision: simplest useful version first). Messages older than
 * CHAT_RETENTION_DAYS are hard-deleted, opportunistically: every send/poll
 * has a cheap chance to trigger a cleanup sweep, throttled by
 * GymChatCleanupState so the actual DELETE only runs at most once every
 * CLEANUP_THROTTLE_HOURS. No Railway cron job needed — cleanup rides along
 * with real chat activity, which is exactly when there's anything to clean.
 */

export const CHAT_RETENTION_DAYS = 90;
export const CHAT_MESSAGE_MAX_LENGTH = 4000;
const CLEANUP_THROTTLE_HOURS = 24;

export type ChatMessageRow = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; accessRole: string };
};

function mapMessage(m: { id: string; body: string; createdAt: Date; author: { id: string; name: string; accessRole: string } }): ChatMessageRow {
  return { id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), author: m.author };
}

/** Latest `limit` messages, oldest-first (ready to render top-to-bottom). */
export async function getInitialChatMessages(limit = 50): Promise<ChatMessageRow[]> {
  const rows = await prisma.gymChatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { author: { select: { id: true, name: true, accessRole: true } } },
  });
  return rows.reverse().map(mapMessage);
}

/** Messages strictly after `sinceISO`, oldest-first — the polling delta. */
export async function getChatMessagesSince(sinceISO: string): Promise<ChatMessageRow[]> {
  const rows = await prisma.gymChatMessage.findMany({
    where: { createdAt: { gt: new Date(sinceISO) } },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, accessRole: true } } },
  });
  return rows.map(mapMessage);
}

/** Cheap count-only check for the closed widget's unread badge. */
export async function getUnreadChatCount(sinceISO: string): Promise<number> {
  return prisma.gymChatMessage.count({ where: { createdAt: { gt: new Date(sinceISO) } } });
}

export async function postChatMessage(authorId: string, rawBody: string): Promise<ChatMessageRow> {
  const body = rawBody.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH);
  if (!body) throw new Error("Message can't be empty.");

  const created = await prisma.gymChatMessage.create({
    data: { body, authorId },
    include: { author: { select: { id: true, name: true, accessRole: true } } },
  });

  // Awaited, not fire-and-forget: in a server/request environment there's
  // no guarantee a detached promise finishes after the response is sent
  // (confirmed locally — a backgrounded cleanup call was still in flight
  // when its triggering process exited). Throttled to once per 24h, so
  // this only adds real latency to the one send a day that triggers it.
  try {
    await maybeCleanupOldChatMessages();
  } catch (err) {
    console.error("chat cleanup failed", err);
  }

  return mapMessage(created);
}

async function maybeCleanupOldChatMessages(): Promise<void> {
  const state = await prisma.gymChatCleanupState.findUnique({ where: { id: "singleton" } });
  const throttleMs = CLEANUP_THROTTLE_HOURS * 60 * 60 * 1000;
  if (state?.lastRunAt && Date.now() - state.lastRunAt.getTime() < throttleMs) return;

  const cutoff = new Date(Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.gymChatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.gymChatCleanupState.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", lastRunAt: new Date() },
      update: { lastRunAt: new Date() },
    }),
  ]);
}
