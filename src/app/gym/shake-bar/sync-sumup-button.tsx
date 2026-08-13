"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncGoodtillAction } from "@/actions/gym/goodtill";
import { cn } from "@/lib/utils";

export function SyncSumUpButton() {
  const [syncing, setSyncing] = React.useState(false);

  async function run() {
    setSyncing(true);
    try {
      const result = await syncGoodtillAction();
      toast.success(`Synced SumUp — ${result.products} products, ${result.categories} categories, ${result.salesChecked} sales checked`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={run} disabled={syncing}>
      <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
      {syncing ? "Syncing…" : "Sync SumUp"}
    </Button>
  );
}
