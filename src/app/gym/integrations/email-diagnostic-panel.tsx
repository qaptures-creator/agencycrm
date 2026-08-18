"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { testEmailConnectionAction } from "@/actions/gym/email-diagnostics";
import type { EmailConnectionTestResult } from "@/lib/email/types";
import { cn } from "@/lib/utils";

type EnvSummary =
  | {
      configured: true;
      addressPreview: string;
      fromName: string;
      imapHost: string;
      imapPort: number;
      imapSecure: boolean;
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      syncEnabled: boolean;
    }
  | { configured: false; missing: string[] };

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("inline-flex items-center gap-1.5 font-medium", ok ? "text-success" : "text-destructive")}>
        <Icon className="size-3.5" />
        {ok ? "Found" : "Not found"}
      </span>
    </div>
  );
}

export function EmailDiagnosticPanel({ canManage, envSummary }: { canManage: boolean; envSummary: EnvSummary }) {
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<EmailConnectionTestResult | null>(null);

  async function runTest() {
    setTesting(true);
    setResult(null);
    try {
      const r = await testEmailConnectionAction();
      setResult(r);
    } catch (err) {
      setResult({
        configured: envSummary.configured,
        imap: { ok: false, error: err instanceof Error ? err.message : "Test failed" },
        smtp: { ok: false },
        folders: { inbox: false, sent: false, drafts: false, spam: false, trash: false },
        folderPaths: {},
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
      {envSummary.configured ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Mailbox: <span className="font-medium text-foreground">{envSummary.addressPreview}</span>
          </p>
          <p>
            IMAP: {envSummary.imapHost}:{envSummary.imapPort} {envSummary.imapSecure ? "(TLS)" : ""}
          </p>
          <p>
            SMTP: {envSummary.smtpHost}:{envSummary.smtpPort} {envSummary.smtpSecure ? "(TLS)" : ""}
          </p>
        </div>
      ) : (
        <p className="text-xs text-warning-foreground">
          Not configured — missing Railway env var{envSummary.missing.length === 1 ? "" : "s"}:{" "}
          <span className="font-mono">{envSummary.missing.join(", ")}</span>
        </p>
      )}

      {canManage && (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={runTest} disabled={testing || !envSummary.configured}>
          {testing ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5" />}
          {testing ? "Testing…" : "Test Email Connection"}
        </Button>
      )}

      {result && (
        <div className="space-y-1.5 rounded-md border border-border bg-card p-3">
          <StatusRow label="IMAP" ok={result.imap.ok} />
          {result.imap.error && <p className="text-xs text-destructive">{result.imap.error}</p>}
          {result.imap.ok && (
            <>
              <StatusRow label="Inbox" ok={result.folders.inbox} />
              <StatusRow label="Sent" ok={result.folders.sent} />
              <StatusRow label="Drafts" ok={result.folders.drafts} />
              <StatusRow label="Spam" ok={result.folders.spam} />
              <StatusRow label="Trash" ok={result.folders.trash} />
            </>
          )}
          <StatusRow label="SMTP" ok={result.smtp.ok} />
          {result.smtp.error && <p className="text-xs text-destructive">{result.smtp.error}</p>}
        </div>
      )}
    </div>
  );
}
