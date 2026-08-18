import "server-only";
import { isEmailConfigured } from "./config";
import { withImapClient, discoverFolders, ImapConnectionError } from "./imap";
import { testSmtpConnection } from "./smtp";
import type { EmailConnectionTestResult } from "./types";

/**
 * Safe, read-only connection diagnostic. Connects to IMAP, discovers the
 * well-known folders, and verifies SMTP auth — never sends a message, never
 * returns anything beyond ok/found booleans and non-secret folder paths.
 * This is the only thing the Settings → Integrations "Test Email
 * Connection" control calls.
 */
export async function testEmailConnection(): Promise<EmailConnectionTestResult> {
  const result: EmailConnectionTestResult = {
    configured: isEmailConfigured(),
    imap: { ok: false },
    smtp: { ok: false },
    folders: { inbox: false, sent: false, drafts: false, spam: false, trash: false },
    folderPaths: {},
  };

  if (!result.configured) return result;

  try {
    const { byRole } = await withImapClient(async (client) => discoverFolders(client));
    result.imap.ok = true;
    result.folderPaths = byRole;
    result.folders = {
      inbox: !!byRole.inbox,
      sent: !!byRole.sent,
      drafts: !!byRole.drafts,
      spam: !!byRole.spam,
      trash: !!byRole.trash,
    };
  } catch (err) {
    result.imap.ok = false;
    result.imap.error = err instanceof ImapConnectionError ? err.message : "IMAP connection failed";
  }

  const smtp = await testSmtpConnection();
  result.smtp = smtp.ok ? { ok: true } : { ok: false, error: smtp.error };

  return result;
}
