"use server";

import { assertPermission } from "@/lib/gym/auth";
import { testEmailConnection } from "@/lib/email/diagnostics";
import { getEmailDiagnosticEnvSummary } from "@/lib/email/config";
import { logAudit } from "@/lib/gym/audit";
import type { EmailConnectionTestResult } from "@/lib/email/types";

/** Admin-only. Runs the safe read-only IMAP/SMTP connection diagnostic —
 * never sends mail, never returns credentials. */
export async function testEmailConnectionAction(): Promise<EmailConnectionTestResult> {
  const user = await assertPermission("manageEmail");
  const result = await testEmailConnection();

  await logAudit({
    userId: user.id,
    action: "EMAIL_CONNECTION_TESTED",
    entityType: "EmailIntegration",
    metadata: {
      configured: result.configured,
      imapOk: result.imap.ok,
      smtpOk: result.smtp.ok,
      foldersFound: result.folders,
    },
  });

  return result;
}

/** Admin-only. Non-secret env summary (hosts/ports/masked address) shown
 * alongside the diagnostic so staff can see what's configured without ever
 * seeing the password. */
export async function getEmailDiagnosticEnvSummaryAction() {
  await assertPermission("manageEmail");
  return getEmailDiagnosticEnvSummary();
}
