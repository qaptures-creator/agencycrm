import "server-only";
import { prisma } from "@/lib/prisma";
import type { WellKnownFolder } from "@/lib/email/types";

const PAGE_SIZE = 50;

export type EmailListRow = {
  id: string;
  fromAddress: string | null;
  fromName: string | null;
  subject: string | null;
  receivedAt: string | null;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
};

export async function getFolderCounts() {
  const [inbox, unread, sent, drafts, spam, trash] = await Promise.all([
    prisma.gymEmailMessage.count({ where: { folderRole: "inbox" } }),
    prisma.gymEmailMessage.count({ where: { folderRole: "inbox", isRead: false } }),
    prisma.gymEmailMessage.count({ where: { folderRole: "sent" } }),
    prisma.gymEmailMessage.count({ where: { folderRole: "drafts" } }),
    prisma.gymEmailMessage.count({ where: { folderRole: "spam" } }),
    prisma.gymEmailMessage.count({ where: { folderRole: "trash" } }),
  ]);
  return { inbox, unread, sent, drafts, spam, trash };
}

export async function getMessageList(
  folder: WellKnownFolder,
  opts: { before?: string; unreadOnly?: boolean } = {}
): Promise<{ rows: EmailListRow[]; hasMore: boolean }> {
  const rows = await prisma.gymEmailMessage.findMany({
    where: {
      folderRole: folder,
      ...(opts.unreadOnly ? { isRead: false } : {}),
      ...(opts.before ? { receivedAt: { lt: new Date(opts.before) } } : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      fromAddress: true,
      fromName: true,
      subject: true,
      receivedAt: true,
      isRead: true,
      isFlagged: true,
      hasAttachments: true,
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return {
    rows: page.map((r) => ({ ...r, receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null })),
    hasMore,
  };
}

export async function getMessageRow(id: string) {
  return prisma.gymEmailMessage.findUnique({ where: { id } });
}
