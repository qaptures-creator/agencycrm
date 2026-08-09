"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Wallet, TrendingUp, AlertTriangle, Clock, Trophy, KanbanSquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { InvoiceForm } from "./invoice-form";
import { INVOICE_STATUSES, INVOICE_TYPES, labelFor } from "@/lib/constants";
import { calcMRR, calcRevenueThisMonth, calcOutstanding, calcOverdue, calcPipelineValue, calcWonValue, isInvoiceOverdue } from "@/lib/finance";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { updateInvoiceStatus } from "@/actions/invoices";
import { toast } from "sonner";
import type { Client, Invoice, Lead, PipelineStage, Retainer } from "@prisma/client";

type ClientWithRetainer = Client & { retainer: Retainer | null };
type InvoiceWithClient = Invoice & { client: Client };
type LeadWithStage = Lead & { stage: PipelineStage };

export function FinanceView({
  invoices,
  clients,
  leads,
}: {
  invoices: InvoiceWithClient[];
  clients: ClientWithRetainer[];
  leads: LeadWithStage[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [clientFilter, setClientFilter] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InvoiceWithClient | null>(null);

  const mrr = calcMRR(clients);
  const revenueThisMonth = calcRevenueThisMonth(invoices);
  const outstanding = calcOutstanding(invoices);
  const overdue = calcOverdue(invoices);
  const pipelineValue = calcPipelineValue(leads);
  const wonValue = calcWonValue(leads);

  const filtered = invoices.filter((i) => {
    if (clientFilter !== "all" && i.clientId !== clientFilter) return false;
    if (statusFilter !== "all") {
      const effective = isInvoiceOverdue(i) ? "OVERDUE" : i.status;
      if (effective !== statusFilter) return false;
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!`${i.description ?? ""} ${i.client.companyName}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function markPaid(id: string) {
    await updateInvoiceStatus(id, "PAID");
    toast.success("Marked as paid");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">High-level revenue and invoicing overview.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus /> New invoice
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="MRR" value={formatCurrency(mrr)} icon={TrendingUp} tone="success" />
        <StatCard label="Revenue This Month" value={formatCurrency(revenueThisMonth)} icon={Wallet} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Clock} tone="warning" />
        <StatCard label="Overdue" value={formatCurrency(overdue)} icon={AlertTriangle} tone={overdue > 0 ? "destructive" : "default"} />
        <StatCard label="Pipeline Value" value={formatCurrency(pipelineValue)} icon={KanbanSquare} />
        <StatCard label="Won Deal Value" value={formatCurrency(wonValue)} icon={Trophy} tone="success" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoices…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={invoices.length === 0 ? "No invoices yet" : "No invoices match your filters"}
          description={invoices.length === 0 ? "Create your first invoice to start tracking payments." : "Try adjusting your search or filters."}
          action={invoices.length === 0 ? <Button size="sm" onClick={() => setDialogOpen(true)}><Plus /> New invoice</Button> : undefined}
        />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
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
              {filtered.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => { setEditing(inv); setDialogOpen(true); }}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${inv.clientId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {inv.client.companyName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{inv.description || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{labelFor(INVOICE_TYPES, inv.type)}</TableCell>
                  <TableCell>{formatCurrency(inv.amount, true)}</TableCell>
                  <TableCell>
                    <StatusBadge list={INVOICE_STATUSES} value={isInvoiceOverdue(inv) ? "OVERDUE" : inv.status} />
                  </TableCell>
                  <TableCell className={cn(isInvoiceOverdue(inv) && "font-medium text-destructive")}>{formatDate(inv.dueDate)}</TableCell>
                  <TableCell>{formatDate(inv.paidDate)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {inv.status !== "PAID" && (
                      <Button size="sm" variant="ghost" onClick={() => markPaid(inv.id)}>
                        <Check /> Mark paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }} title={editing ? "Edit invoice" : "New invoice"}>
        <InvoiceForm
          invoice={editing ?? undefined}
          clients={clients}
          onSuccess={() => {
            setDialogOpen(false);
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
