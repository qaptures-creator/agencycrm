import { Receipt } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/utils";
import { moneyGBP } from "./money";
import type { getGoodtillRecentSales } from "@/lib/gym/integrations/goodtill-analytics";

type RecentSales = Awaited<ReturnType<typeof getGoodtillRecentSales>>;

export function PosRecentSales({ sales }: { sales: RecentSales }) {
  if (sales.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No sales yet"
        description="Sales will appear here automatically as they come through SumUp, or click Sync SumUp to pull recent history."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date/Time</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(s.saleDateTime)}</TableCell>
              <TableCell className="max-w-xs truncate" title={s.itemSummary}>
                {s.itemSummary}
              </TableCell>
              <TableCell className="text-muted-foreground">{s.paymentMethods || "—"}</TableCell>
              <TableCell>
                <Badge variant={s.orderStatus === "VOIDED" ? "destructive" : "success"}>{s.orderStatus ?? "UNKNOWN"}</Badge>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{moneyGBP(s.totalIncVat)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
