/** Shared types for the server-only email service layer. Nothing in this
 * file touches the network — safe to import from anywhere (though the
 * actual IMAP/SMTP clients in imap.ts/smtp.ts are server-only). */

export type WellKnownFolder = "inbox" | "sent" | "drafts" | "spam" | "trash";

export type DiscoveredFolder = {
  /** The real IMAP mailbox path, e.g. "INBOX", "Sent", "INBOX.Sent". */
  path: string;
  /** RFC 6154 special-use flag if the server advertises one, e.g. "\\Sent". */
  specialUse: string | null;
  /** Which well-known role this folder was matched to, if any. */
  role: WellKnownFolder | null;
};

export type EmailConnectionTestResult = {
  configured: boolean;
  imap: { ok: boolean; error?: string };
  smtp: { ok: boolean; error?: string };
  folders: {
    inbox: boolean;
    sent: boolean;
    drafts: boolean;
    spam: boolean;
    trash: boolean;
  };
  folderPaths: Partial<Record<WellKnownFolder, string>>;
};
