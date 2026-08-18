import "server-only";
import type { ImapFlow, MessageAddressObject, MessageStructureObject, FetchMessageObject } from "imapflow";
import { prisma } from "@/lib/prisma";
import { withImapClient, discoverFolders } from "./imap";
import type { WellKnownFolder } from "./types";

/**
 * Incremental IMAP → Postgres sync. The mailbox stays the source of truth
 * for content — only lightweight metadata is persisted (see schema comment
 * on GymEmailMessage). A fresh connection is opened per sync run (see
 * withImapClient) rather than holding one open, since Railway can't
 * guarantee a long-lived connection survives between requests.
 *
 * Per-folder checkpoint: { uidValidity, lastUid, oldestSyncedSeq }.
 *  - uidValidity: if this changes, the server has renumbered the mailbox —
 *    every previously stored UID for that folder is now meaningless, so
 *    those rows are deleted and the folder is re-synced from scratch.
 *  - lastUid: the highest UID synced so far — incremental sync only fetches
 *    UIDs above this.
 *  - oldestSyncedSeq: the sequence number of the oldest message synced —
 *    "load older" pages backward from here.
 */

const INITIAL_SYNC_BATCH = 200;
const LOAD_OLDER_BATCH = 100;
const FLAG_REFRESH_WINDOW = 200;
const ROLES: WellKnownFolder[] = ["inbox", "sent", "drafts", "spam", "trash"];

type FolderSyncState = { uidValidity: string; lastUid: number; oldestSyncedSeq: number };
type FolderStateMap = Partial<Record<WellKnownFolder, FolderSyncState>>;

async function getSyncStateRow() {
  return prisma.gymEmailSyncState.findUnique({ where: { id: "singleton" } });
}

async function touchSyncState(data: {
  lastRunAt?: Date;
  lastRunStatus?: string;
  lastRunError?: string | null;
  folderState?: FolderStateMap;
}) {
  await prisma.gymEmailSyncState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
}

export async function isSyncStale(maxAgeMs: number): Promise<boolean> {
  const row = await getSyncStateRow();
  if (!row?.lastRunAt) return true;
  return Date.now() - row.lastRunAt.getTime() > maxAgeMs;
}

function addressesToJson(list?: MessageAddressObject[]) {
  return (list ?? []).map((a) => ({ name: a.name ?? null, address: a.address ?? null }));
}

function structureHasAttachments(node?: MessageStructureObject): boolean {
  if (!node) return false;
  if (node.disposition && node.disposition.toLowerCase() === "attachment") return true;
  if (!node.disposition && node.parameters?.name) return true; // some clients omit disposition
  return (node.childNodes ?? []).some(structureHasAttachments);
}

async function upsertMessage(role: WellKnownFolder, path: string, msg: FetchMessageObject) {
  const env = msg.envelope;
  const from = env?.from?.[0];
  const flags = msg.flags ?? new Set<string>();

  await prisma.gymEmailMessage.upsert({
    where: { imapPath_imapUid: { imapPath: path, imapUid: msg.uid } },
    create: {
      folderRole: role,
      imapPath: path,
      imapUid: msg.uid,
      messageId: env?.messageId ?? null,
      inReplyTo: env?.inReplyTo ?? null,
      fromAddress: from?.address ?? null,
      fromName: from?.name ?? null,
      toAddresses: addressesToJson(env?.to),
      ccAddresses: addressesToJson(env?.cc),
      subject: env?.subject ?? null,
      receivedAt: env?.date ?? null,
      isRead: flags.has("\\Seen"),
      isFlagged: flags.has("\\Flagged"),
      hasAttachments: structureHasAttachments(msg.bodyStructure),
      sizeBytes: msg.size ?? null,
    },
    update: {
      isRead: flags.has("\\Seen"),
      isFlagged: flags.has("\\Flagged"),
      lastSyncedAt: new Date(),
    },
  });
}

async function refreshFlags(path: string, uid: number, flags?: Set<string>) {
  if (!flags) return;
  await prisma.gymEmailMessage.updateMany({
    where: { imapPath: path, imapUid: uid },
    data: { isRead: flags.has("\\Seen"), isFlagged: flags.has("\\Flagged"), lastSyncedAt: new Date() },
  });
}

async function syncOneFolder(
  client: ImapFlow,
  role: WellKnownFolder,
  path: string,
  prior: FolderSyncState | undefined
): Promise<{ state: FolderSyncState; syncedCount: number }> {
  const mailbox = await client.mailboxOpen(path, { readOnly: true });
  const uidValidity = mailbox.uidValidity.toString();
  const isReset = !prior || prior.uidValidity !== uidValidity;

  if (isReset && prior) {
    // UIDVALIDITY changed — every previously stored UID for this folder is
    // now potentially pointing at a different message. Wipe and re-sync.
    await prisma.gymEmailMessage.deleteMany({ where: { imapPath: path } });
  }

  let syncedCount = 0;
  let highestUid = isReset ? 0 : prior!.lastUid;
  let oldestSyncedSeq = isReset ? 0 : prior!.oldestSyncedSeq;

  if (isReset) {
    const total = mailbox.exists;
    if (total > 0) {
      const startSeq = Math.max(1, total - INITIAL_SYNC_BATCH + 1);
      for await (const msg of client.fetch(`${startSeq}:*`, { uid: true, envelope: true, flags: true, size: true, bodyStructure: true })) {
        await upsertMessage(role, path, msg);
        syncedCount++;
        if (msg.uid > highestUid) highestUid = msg.uid;
      }
      oldestSyncedSeq = startSeq;
    }
  } else {
    if (mailbox.uidNext - 1 > prior!.lastUid) {
      for await (const msg of client.fetch(`${prior!.lastUid + 1}:*`, { uid: true, envelope: true, flags: true, size: true, bodyStructure: true }, { uid: true })) {
        if (msg.uid <= prior!.lastUid) continue;
        await upsertMessage(role, path, msg);
        syncedCount++;
        if (msg.uid > highestUid) highestUid = msg.uid;
      }
    }
    // Catch read/unread + flag changes made outside the CRM (e.g. webmail)
    // for the most recently synced window, without re-downloading content.
    if (highestUid > 0) {
      const refreshFromUid = Math.max(1, highestUid - FLAG_REFRESH_WINDOW + 1);
      for await (const msg of client.fetch(`${refreshFromUid}:${highestUid}`, { uid: true, flags: true }, { uid: true })) {
        await refreshFlags(path, msg.uid, msg.flags);
      }
    }
  }

  return { state: { uidValidity, lastUid: highestUid, oldestSyncedSeq }, syncedCount };
}

export type SyncSummary = { ok: true; synced: Partial<Record<WellKnownFolder, number>> } | { ok: false; error: string };

/** Manual "Sync Mail" entry point, also called on page load when stale. */
export async function syncAllFolders(): Promise<SyncSummary> {
  await touchSyncState({ lastRunStatus: "RUNNING" });

  try {
    const priorRow = await getSyncStateRow();
    const priorState = (priorRow?.folderState as FolderStateMap | null) ?? {};

    const { newState, synced } = await withImapClient(async (client) => {
      const { byRole } = await discoverFolders(client);
      const newState: FolderStateMap = { ...priorState };
      const synced: Partial<Record<WellKnownFolder, number>> = {};

      for (const role of ROLES) {
        const path = byRole[role];
        if (!path) continue;
        const { state, syncedCount } = await syncOneFolder(client, role, path, priorState[role]);
        newState[role] = state;
        synced[role] = syncedCount;
      }

      return { newState, synced };
    });

    await touchSyncState({ lastRunAt: new Date(), lastRunStatus: "OK", lastRunError: null, folderState: newState });
    return { ok: true, synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await touchSyncState({ lastRunAt: new Date(), lastRunStatus: "ERROR", lastRunError: message });
    return { ok: false, error: message };
  }
}

/** Pages further back into folder history — only called when staff
 * explicitly ask for older mail than what's synced locally. */
export async function loadOlderMessages(role: WellKnownFolder): Promise<{ ok: true; loaded: number } | { ok: false; error: string }> {
  try {
    const priorRow = await getSyncStateRow();
    const priorState = (priorRow?.folderState as FolderStateMap | null) ?? {};
    const prior = priorState[role];
    if (!prior || prior.oldestSyncedSeq <= 1) return { ok: true, loaded: 0 }; // nothing older, or never synced yet

    const loaded = await withImapClient(async (client) => {
      const { byRole } = await discoverFolders(client);
      const path = byRole[role];
      if (!path) return 0;

      const endSeq = prior.oldestSyncedSeq - 1;
      const startSeq = Math.max(1, endSeq - LOAD_OLDER_BATCH + 1);
      if (endSeq < 1) return 0;

      let count = 0;
      for await (const msg of client.fetch(`${startSeq}:${endSeq}`, { uid: true, envelope: true, flags: true, size: true, bodyStructure: true })) {
        await upsertMessage(role, path, msg);
        count++;
      }

      priorState[role] = { ...prior, oldestSyncedSeq: startSeq };
      return count;
    });

    await touchSyncState({ folderState: priorState });
    return { ok: true, loaded };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error loading older messages" };
  }
}

export async function hasMoreOlderMessages(role: WellKnownFolder): Promise<boolean> {
  const row = await getSyncStateRow();
  const state = (row?.folderState as FolderStateMap | null)?.[role];
  return !!state && state.oldestSyncedSeq > 1;
}
