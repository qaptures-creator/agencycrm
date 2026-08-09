"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Wallet, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { StatusBadge } from "@/components/status-badge";
import { InvoiceForm } from "@/app/(app)/finance/invoice-form";
import { INVOICE_STATUSES, INVOICE_TYPES, labelFor } from "@/lib/constants";
import { formatCurrency, formatDate, isOverdue } from "@/lib/utils";
import { updateInvoiceStatus } from "@/actions/invoices";
import { toast } from "sonner";
import type { Client, Invoice } from "@prisma/client";

export function InvoicesTab({ client, invoices }: { client: Client; invoices: Invoice[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Invoice | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(inv: Invoice) {
    setEditing(inv);
    setDialogOpen(true);
  }

  async function markPaid(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await updateInvoiceStatus(id, "PAID");
    toast.success("Marked as paid");
    router.refresh();
  }

  const totalOutstanding = invoices
    .filter((i) => ["SENT", "DUE", "OVERDUE"].includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
          {totalOutstanding > 0 && ` · ${formatCurrency(totalOutstanding)} outstanding`}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus /> New invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={Wallet} title="No invoices yet" description="Track retainers, one-off projects and payments here." />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const overdue = inv.status !== "PAID" && isOverdue(inv.dueDate);
                return (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => openEdit(inv)}>
                    <TableCell className="font-medium">{inv.description || labelFor(INVOICE_TYPES, inv.type)}</TableCell>
                    <TableCell className="text-muted-foreground">{labelFor(INVOICE_TYPES, inv.type)}</TableCell>
                    <TableCell>{formatCurrency(inv.amount, true)}</TableCell>
                    <TableCell>
                      <StatusBadge list={INVOICE_STATUSES} value={overdue ? "OVERDUE" : inv.status} />
                    </TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>{formatDate(inv.paidDate)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {inv.status !== "PAID" && (
                        <Button size="sm" variant="ghost" onClick={(e) => markPaid(inv.id, e)}>
                          <Check /> Mark paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit invoice" : "New invoice"}>
        <InvoiceForm
          invoice={editing ?? undefined}
          clients={[client]}
          defaultClientId={client.id}
          onSuccess={() => {
            setDialogOpen(false);
            router.refresh();
          }}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
