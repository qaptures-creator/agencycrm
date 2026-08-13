import { CheckCircle2, AlertCircle, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { SyncSumUpButton } from "./sync-sumup-button";
import type { getGoodtillSyncStatus } from "@/lib/gym/integrations/goodtill-sync";

type SyncState = Awaited<ReturnType<typeof getGoodtillSyncStatus>>;

export function PosStatusBar({ status }: { status: SyncState }) {
  const hasEverSynced = !!(status?.lastCatalogSyncAt || status?.lastWebhookAt);
  const lastSyncFailed = status?.lastSalesSyncStatus === "ERROR";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5">
        {hasEverSynced ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="size-3.5" />
            SumUp Connected
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <CircleDashed className="size-3.5" />
            Not Synced Yet
          </Badge>
        )}
        {lastSyncFailed && (
          <Badge variant="destructive" className="gap-1" title={status?.lastSalesSyncError ?? undefined}>
            <AlertCircle className="size-3.5" />
            Last sync failed
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Last webhook: <span className="font-medium text-foreground">{status?.lastWebhookAt ? formatDateTime(status.lastWebhookAt) : "None yet"}</span>
        </span>
        <span>
          Last API sync: <span className="font-medium text-foreground">{status?.lastSalesSyncAt ? formatDateTime(status.lastSalesSyncAt) : "Never"}</span>
        </span>
      </div>

      <div className="ml-auto">
        <SyncSumUpButton />
      </div>
    </div>
  );
}
