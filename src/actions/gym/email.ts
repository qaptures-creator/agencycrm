"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/gym/auth";
import { syncAllFolders, loadOlderMessages, isSyncStale } from "@/lib/email/sync";
import { fetchMessageDetail, type MessageDetail } from "@/lib/email/message-detail";
import { setMessageReadState } from "@/lib/email/flags";
import { getMessageRow } from "@/lib/gym/email-data";
import type { WellKnownFolder } from "@/lib/email/types";

export async function syncEmailAction() {
  await assertPermission("viewEmail");
  const result = await syncAllFolders();
  revalidatePath("/gym/email");
  return result;
}

/** Called on page load — syncs only if the last run is stale, so opening
 * the Email page never triggers an expensive full mailbox download. */
export async function syncEmailIfStaleAction(maxAgeMs = 2 * 60 * 1000) {
  await assertPermission("viewEmail");
  if (!(await isSyncStale(maxAgeMs))) return { ok: true as const, skipped: true as const };
  const result = await syncAllFolders();
  revalidatePath("/gym/email");
  return { ...result, skipped: false as const };
}

export async function loadOlderMessagesAction(folder: WellKnownFolder) {
  await assertPermission("viewEmail");
  const result = await loadOlderMessages(folder);
  revalidatePath("/gym/email");
  return result;
}

export async function getMessageDetailAction(id: string): Promise<MessageDetail> {
  await assertPermission("viewEmail");
  const row = await getMessageRow(id);
  if (!row) throw new Error("Message not found");

  const detail = await fetchMessageDetail(row.imapPath, row.imapUid);

  if (!row.isRead) {
    await setMessageReadState(id, true).catch(() => {
      // Best-effort — the detail itself already fetched successfully, so
      // don't fail the whole open just because the flag update didn't land.
    });
  }

  revalidatePath("/gym/email");
  return detail;
}

export async function setMessageReadAction(id: string, read: boolean) {
  await assertPermission("viewEmail");
  await setMessageReadState(id, read);
  revalidatePath("/gym/email");
}
