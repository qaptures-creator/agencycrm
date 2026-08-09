import type { Client, Invoice, Lead, PipelineStage, Retainer } from "@prisma/client";

type ClientWithRetainer = Client & { retainer: Retainer | null };
type LeadWithStage = Lead & { stage: PipelineStage };

export function isInvoiceOverdue(invoice: Invoice) {
  if (invoice.status === "PAID") return false;
  if (invoice.status === "OVERDUE") return true;
  if (!invoice.dueDate) return false;
  return new Date(invoice.dueDate).getTime() < Date.now();
}

export function calcMRR(clients: ClientWithRetainer[]) {
  return clients
    .filter((c) => c.status === "ACTIVE")
    .reduce((sum, c) => sum + (c.retainer?.monthlyRetainer ?? c.monthlyRetainer ?? 0), 0);
}

export function calcRevenueThisMonth(invoices: Invoice[], now = new Date()) {
  return invoices
    .filter((i) => i.status === "PAID" && i.paidDate)
    .filter((i) => {
      const d = new Date(i.paidDate!);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, i) => sum + i.amount, 0);
}

export function calcOutstanding(invoices: Invoice[]) {
  return invoices.filter((i) => !isInvoiceOverdue(i) && i.status !== "PAID" && i.status !== "DRAFT").reduce((sum, i) => sum + i.amount, 0);
}

export function calcOverdue(invoices: Invoice[]) {
  return invoices.filter(isInvoiceOverdue).reduce((sum, i) => sum + i.amount, 0);
}

export function calcPipelineValue(leads: LeadWithStage[]) {
  return leads.filter((l) => !l.stage.isWon && !l.stage.isLost).reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
}

export function calcWonValue(leads: LeadWithStage[]) {
  return leads.filter((l) => l.stage.isWon).reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
}

export function calcConversionRate(leads: LeadWithStage[]) {
  const closed = leads.filter((l) => l.stage.isWon || l.stage.isLost);
  if (closed.length === 0) return 0;
  const won = closed.filter((l) => l.stage.isWon).length;
  return Math.round((won / closed.length) * 100);
}
