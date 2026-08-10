"use client";

import * as React from "react";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { loadAuditLogPageAction } from "@/actions/gym/audit-log";
import { formatDateTime } from "@/lib/utils";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  user: { name: string; email: string } | null;
};

function actionLabel(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export function AuditLogPanel({ initialRows, initialHasMore }: { initialRows: AuditRow[]; initialHasMore: boolean }) {
  const [rows, setRows] = React.useState(initialRows);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loading, setLoading] = React.useState(false);

  async function handleLoadMore() {
    setLoading(true);
    try {
      const { rows: nextRows, hasMore: nextHasMore } = await loadAuditLogPageAction(rows.length);
      setRows((prev) => [...prev, ...nextRows]);
      setHasMore(nextHasMore);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoading(false);
    }
  }

  if (rows.length === 0) {
    return <EmptyState icon={ScrollText} title="No activity recorded yet" description="Every create/update across the gym CRM will show here as it happens." />;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Entity</th>
              <th className="px-4 py-2.5 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">{r.user?.name ?? "System"}</td>
                <td className="px-4 py-2.5">{actionLabel(r.action)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {r.entityType}
                  {r.entityId ? ` · ${r.entityId.slice(0, 10)}…` : ""}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
