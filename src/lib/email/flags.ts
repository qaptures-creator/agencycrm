import "server-only";
import { prisma } from "@/lib/prisma";
import { withImapClient } from "./imap";

/** Marks a message read/unread in the real mailbox first, then mirrors the
 * result into the local metadata row — the mailbox flag is the source of
 * truth, the DB row is a cache of it. */
export async function setMessageReadState(messageDbId: string, read: boolean): Promise<void> {
  const row = await prisma.gymEmailMessage.findUnique({ where: { id: messageDbId } });
  if (!row) throw new Error("Message not found");

  await withImapClient(async (client) => {
    await client.mailboxOpen(row.imapPath);
    if (read) {
      await client.messageFlagsAdd(String(row.imapUid), ["\\Seen"], { uid: true });
    } else {
      await client.messageFlagsRemove(String(row.imapUid), ["\\Seen"], { uid: true });
    }
  });

  await prisma.gymEmailMessage.update({ where: { id: messageDbId }, data: { isRead: read } });
}
