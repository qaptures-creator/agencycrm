import "server-only";
import { ImapFlow, type ImapFlowOptions } from "imapflow";
import { getEmailConfig, type EmailConfig } from "./config";
import type { DiscoveredFolder, WellKnownFolder } from "./types";

/**
 * Thin, server-only wrapper around ImapFlow. Railway/Next's serverless-ish
 * runtime can't rely on one persistent IDLE connection surviving across
 * requests, so every call here opens a fresh connection, does its work, and
 * always closes it in a `finally` — see withImapClient(). Sync/list
 * operations should batch as much as they need inside one withImapClient
 * call rather than opening a connection per message.
 */

/** Strips a known secret value out of an error message before it can ever
 * reach a log line or the UI. Defence in depth — ImapFlow shouldn't echo
 * the password back, but nothing here trusts that assumption. */
function redact(message: string, cfg: EmailConfig): string {
  let out = message;
  if (cfg.password) out = out.split(cfg.password).join("[redacted]");
  return out;
}

function buildOptions(cfg: EmailConfig): ImapFlowOptions {
  return {
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapSecure,
    auth: { user: cfg.username, pass: cfg.password },
    logger: false,
    disableAutoIdle: true,
  };
}

export class ImapConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImapConnectionError";
  }
}

/** Opens a connection, runs `fn`, and guarantees logout/close afterwards —
 * even if `fn` throws. Never leaves a dangling socket. */
export async function withImapClient<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const cfg = getEmailConfig();
  const client = new ImapFlow(buildOptions(cfg));
  try {
    await client.connect();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown IMAP connection error";
    throw new ImapConnectionError(redact(message, cfg));
  }

  try {
    return await fn(client);
  } catch (err) {
    if (err instanceof ImapConnectionError) throw err;
    const message = err instanceof Error ? err.message : "Unknown IMAP error";
    throw new ImapConnectionError(redact(message, cfg));
  } finally {
    try {
      await client.logout();
    } catch {
      // Best-effort — if logout fails the socket is likely already dead.
      client.close();
    }
  }
}

const SPECIAL_USE_TO_ROLE: Record<string, WellKnownFolder> = {
  "\\Inbox": "inbox",
  "\\Sent": "sent",
  "\\Drafts": "drafts",
  "\\Junk": "spam",
  "\\Trash": "trash",
};

// 123 Reg mailboxes (and IMAP servers generally) don't all advertise RFC
// 6154 special-use flags, so fall back to matching common folder names —
// checked in order, first match wins per role.
const NAME_FALLBACKS: Record<WellKnownFolder, RegExp[]> = {
  inbox: [/^inbox$/i],
  sent: [/^sent items$/i, /^sent$/i, /^sent messages$/i],
  drafts: [/^drafts$/i],
  spam: [/^junk$/i, /^junk e-?mail$/i, /^spam$/i],
  trash: [/^deleted items$/i, /^trash$/i, /^deleted messages$/i],
};

/** Lists all mailboxes and matches each well-known role (inbox/sent/drafts/
 * spam/trash) to a real IMAP folder path, preferring RFC 6154 special-use
 * flags and falling back to common names. A role with no match is simply
 * absent from the returned map — callers must handle that, never assume. */
export async function discoverFolders(client: ImapFlow): Promise<{ all: DiscoveredFolder[]; byRole: Partial<Record<WellKnownFolder, string>> }> {
  const list = await client.list();
  const all: DiscoveredFolder[] = list.map((mb) => {
    const specialUse = mb.specialUse ?? null;
    const role = specialUse ? SPECIAL_USE_TO_ROLE[specialUse] ?? null : null;
    return { path: mb.path, specialUse, role };
  });

  const byRole: Partial<Record<WellKnownFolder, string>> = {};

  // Pass 1 — special-use flags.
  for (const f of all) {
    if (f.role && !byRole[f.role]) byRole[f.role] = f.path;
  }
  // INBOX is always the literal path "INBOX" per RFC 3501, regardless of flags.
  if (!byRole.inbox && all.some((f) => f.path.toUpperCase() === "INBOX")) byRole.inbox = "INBOX";

  // Pass 2 — name fallback for anything still unmatched.
  for (const role of Object.keys(NAME_FALLBACKS) as WellKnownFolder[]) {
    if (byRole[role]) continue;
    for (const pattern of NAME_FALLBACKS[role]) {
      const match = all.find((f) => pattern.test(f.path.split(/[./]/).pop() ?? f.path));
      if (match) {
        byRole[role] = match.path;
        break;
      }
    }
  }

  return { all, byRole };
}
