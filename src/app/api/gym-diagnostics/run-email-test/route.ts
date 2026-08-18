import { NextResponse } from "next/server";
import { testEmailConnection } from "@/lib/email/diagnostics";
import { getEmailDiagnosticEnvSummary } from "@/lib/email/config";

/** TEMPORARY — runs the real IMAP/SMTP connection diagnostic against
 * production so results can be verified without needing a logged-in
 * browser session. Read-only: never sends a message. Deleted right after
 * use, same pattern as the earlier sales-import diagnostic route. */
export async function GET(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [result, envSummary] = await Promise.all([testEmailConnection(), Promise.resolve(getEmailDiagnosticEnvSummary())]);
  return NextResponse.json({ result, envSummary });
}
