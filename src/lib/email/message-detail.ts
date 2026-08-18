import "server-only";
import { simpleParser, type AddressObject } from "mailparser";
import { withImapClient } from "./imap";
import { sanitizeEmailHtml } from "./sanitize";

export type MessageAddress = { name: string | null; address: string | null };

export type MessageAttachment = {
  /** Position in the parsed attachments array — used to request a download
   * without ever trusting a client-supplied filename/path. */
  index: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type MessageDetail = {
  subject: string | null;
  from: MessageAddress | null;
  to: MessageAddress[];
  cc: MessageAddress[];
  date: string | null;
  /** Sanitized HTML, safe to render inside a sandboxed iframe. Null if the
   * message has no HTML part. */
  htmlSafe: string | null;
  textPlain: string | null;
  attachments: MessageAttachment[];
};

function addrList(v?: AddressObject | AddressObject[]): MessageAddress[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.flatMap((a) => a.value.map((x) => ({ name: x.name || null, address: x.address || null })));
}

/** Strips path separators and control characters so a filename can never
 * escape its intended directory or contain hidden characters — used for
 * both display and any future on-disk staging. Built from character codes
 * rather than a regex escape range to avoid any ambiguity there. */
export function sanitizeAttachmentFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, ""); // drop any embedded path — prevents path traversal
  const cleaned = Array.from(base)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 31 && code !== 127; // drop ASCII control characters
    })
    .join("")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : "attachment";
}

async function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Fetches and parses the full message body on demand — never persisted,
 * always read live from IMAP so the mailbox stays the source of truth. */
export async function fetchMessageDetail(path: string, uid: number): Promise<MessageDetail> {
  return withImapClient(async (client) => {
    await client.mailboxOpen(path, { readOnly: true });
    const dl = await client.download(String(uid), undefined, { uid: true });
    const raw = await collectStream(dl.content);
    const parsed = await simpleParser(raw, { skipHtmlToText: true });

    return {
      subject: parsed.subject ?? null,
      from: parsed.from?.value[0] ? { name: parsed.from.value[0].name || null, address: parsed.from.value[0].address || null } : null,
      to: addrList(parsed.to),
      cc: addrList(parsed.cc),
      date: parsed.date ? parsed.date.toISOString() : null,
      htmlSafe: parsed.html ? sanitizeEmailHtml(parsed.html) : null,
      textPlain: parsed.text ?? null,
      attachments: parsed.attachments.map((a, index) => ({
        index,
        filename: sanitizeAttachmentFilename(a.filename || `attachment-${index + 1}`),
        contentType: a.contentType || "application/octet-stream",
        sizeBytes: a.size,
      })),
    };
  });
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB — generous for email attachments, bounded against abuse

/** Streams a single attachment's bytes live from IMAP by its position in
 * the message, enforcing a size cap. Never writes to disk. */
export async function fetchAttachment(
  path: string,
  uid: number,
  attachmentIndex: number
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  return withImapClient(async (client) => {
    await client.mailboxOpen(path, { readOnly: true });
    const dl = await client.download(String(uid), undefined, { uid: true });
    const raw = await collectStream(dl.content);
    const parsed = await simpleParser(raw, { skipHtmlToText: true });
    const att = parsed.attachments[attachmentIndex];
    if (!att) return null;
    if (att.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Attachment exceeds the ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB limit`);
    }
    return {
      filename: sanitizeAttachmentFilename(att.filename || `attachment-${attachmentIndex + 1}`),
      contentType: att.contentType || "application/octet-stream",
      content: att.content,
    };
  });
}
