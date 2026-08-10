"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { PAYMENT_TX_STATUSES } from "@/lib/gym/constants";
import { PaymentForm } from "./payment-form";
import { formatDate, cn } from "@/lib/utils";

function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);
}

export type PaymentRow = {
  id: string;
  transactionRef: string | null;
  date: string;
  amount: number;
  type: string;
  status: string;
  provider: string;
  member: { id: string; fullName: string } | null;
};

type MemberOption = { id: string; fullName: string; memberNumber: string };

const TABS = ["All", "Paid", "Pending", "Failed", "Refunded"] as const;
type Tab = (typeof TABS)[number];
const TAB_TO_STATUS: Record<Tab, string | null> = {
  All: null,
  Paid: "PAID",
  Pending: "PENDING",
  Failed: "FAILED",
  Refunded: "REFUNDED",
};

export function PaymentList({ payments, members }: { payments: PaymentRow[]; members: MemberOption[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("All");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const targetStatus = TAB_TO_STATUS[tab];
  const filtered = targetStatus ? payments.filter((p) => p.status === targetStatus) : payments;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)} disabled={members.length === 0}>
          <Plus className="size-4" />
          Record Payment
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={payments.length === 0 ? "No payments recorded" : "No payments match this filter"}
          description={
            payments.length === 0
              ? "Payments logged manually here, or (once connected) synced from Ashbourne, will appear here. No figures are fabricated."
              : "Try a different tab."
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Transaction Ref</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className={p.member ? "cursor-pointer" : undefined}
                  onClick={() => p.member && router.push(`/gym/members/${p.member.id}`)}
                >
                  <TableCell className="font-medium">{p.member?.fullName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.transactionRef || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                  <TableCell>{moneyGBP(p.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.type.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <GymStatusBadge list={PAYMENT_TX_STATUSES} value={p.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.provider}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Record Payment">
        <PaymentForm members={members} onSuccess={() => setDialogOpen(false)} onCancel={() => setDialogOpen(false)} />
      </EntityDialog>
    </div>
  );
}
