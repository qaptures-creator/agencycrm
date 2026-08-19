"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Loader2, FlaskConical, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dryRunAshbourneSyncAction, syncAshbourneMembersAction } from "@/actions/gym/ashbourne";
import type { SyncOutcome } from "@/lib/ashbourne/sync";
import { formatDateTime, cn } from "@/lib/utils";

type EnvSummary =
  | { configured: true; baseUrl: string; usernamePreview: string; memberReportUrl: string; syncEnabled: boolean }
  | { configured: false; missing: string[] };

type LastLog = {
  startedAt: string;
  completedAt: string | null;
  status: string;
  recordsFound: number | null;
  created: number | null;
  updated: number | null;
  reviewRequired: number | null;
  failed: number | null;
} | null;

function OutcomeSummary({ outcome }: { outcome: SyncOutcome }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-center gap-1.5 font-medium">
        {outcome.success ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
        {outcome.dryRun ? "Dry run" : "Sync"} {outcome.success ? "completed" : "failed"}
      </div>
      {outcome.error && <p className="text-xs text-destructive">{outcome.error}</p>}
      {outcome.success && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
          <span>Found: <span className="font-medium text-foreground">{outcome.recordsFound}</span></span>
          <span>Created: <span className="font-medium text-foreground">{outcome.created}</span></span>
          <span>Updated: <span className="font-medium text-foreground">{outcome.updated}</span></span>
          <span>Unchanged: <span className="font-medium text-foreground">{outcome.unchanged}</span></span>
          <span>Review needed: <span className={cn("font-medium", outcome.reviewRequired > 0 ? "text-warning-foreground" : "text-foreground")}>{outcome.reviewRequired}</span></span>
          <span>Failed: <span className={cn("font-medium", outcome.failed > 0 ? "text-destructive" : "text-foreground")}>{outcome.failed}</span></span>
        </div>
      )}
      {outcome.sample && outcome.sample.length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
          <p className="text-xs font-medium text-muted-foreground">Sample ({outcome.sample.length} shown)</p>
          {outcome.sample.map((s, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="font-mono uppercase">{s.action}</span> — {s.name} ({s.memberNo})
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function AshbourneSyncPanel({ envSummary, lastLog }: { envSummary: EnvSummary; lastLog: LastLog }) {
  const [dryRunning, setDryRunning] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [result, setResult] = React.useState<SyncOutcome | null>(null);

  async function runDryRun() {
    setDryRunning(true);
    setResult(null);
    try {
      const r = await dryRunAshbourneSyncAction();
      setResult(r);
    } catch (err) {
      setResult({ success: false, dryRun: true, recordsFound: 0, created: 0, updated: 0, unchanged: 0, reviewRequired: 0, skipped: 0, failed: 0, error: err instanceof Error ? err.message : "Dry run failed" });
    } finally {
      setDryRunning(false);
    }
  }

  async function runSync() {
    if (!confirm("This writes real changes to your Members database (creates/updates records from Ashbourne). Have you reviewed a dry run first? Continue?")) return;
    setSyncing(true);
    setResult(null);
    try {
      const r = await syncAshbourneMembersAction();
      setResult(r);
    } catch (err) {
      setResult({ success: false, dryRun: false, recordsFound: 0, created: 0, updated: 0, unchanged: 0, reviewRequired: 0, skipped: 0, failed: 0, error: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
      {envSummary.configured ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Ashbourne user: <span className="font-medium text-foreground">{envSummary.usernamePreview}</span></p>
          <p>Base URL: {envSummary.baseUrl}</p>
          <p>Member report: <span className="break-all">{envSummary.memberReportUrl}</span></p>
        </div>
      ) : (
        <p className="text-xs text-warning-foreground">
          Not configured — missing Railway env var{envSummary.missing.length === 1 ? "" : "s"}:{" "}
          <span className="font-mono">{envSummary.missing.join(", ")}</span>
        </p>
      )}

      {lastLog && (
        <div className="rounded-md border border-border bg-card p-2.5 text-xs text-muted-foreground">
          <p>
            Last sync: <span className="font-medium text-foreground">{formatDateTime(lastLog.startedAt)}</span> — {lastLog.status}
          </p>
          {lastLog.recordsFound !== null && (
            <p>
              {lastLog.recordsFound} found, {lastLog.created} created, {lastLog.updated} updated
              {lastLog.reviewRequired ? `, ${lastLog.reviewRequired} need review` : ""}
              {lastLog.failed ? `, ${lastLog.failed} failed` : ""}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={runDryRun} disabled={dryRunning || syncing || !envSummary.configured}>
          {dryRunning ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
          {dryRunning ? "Running…" : "Dry Run"}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={runSync} disabled={dryRunning || syncing || !envSummary.configured}>
          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {syncing ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      {result && <OutcomeSummary outcome={result} />}
    </div>
  );
}
