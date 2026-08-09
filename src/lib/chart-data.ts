import type { Lead, PipelineStage, Invoice, Client, Deliverable, DeliverableStatusOption } from "@prisma/client";

type LeadWithStage = Lead & { stage: PipelineStage };
type InvoiceWithClient = Invoice & { client: Client };
type DeliverableWithStatus = Deliverable & { status: DeliverableStatusOption };

function lastNMonths(n: number, ref = new Date()) {
  const months: { key: string; label: string; year: number; month: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

export function monthlyRevenueSeries(invoices: Invoice[], monthsBack = 6) {
  const months = lastNMonths(monthsBack);
  return months.map(({ key, label, year, month }) => {
    const revenue = invoices
      .filter((i) => i.status === "PAID" && i.paidDate)
      .filter((i) => {
        const d = new Date(i.paidDate!);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, i) => sum + i.amount, 0);
    return { month: label, key, revenue };
  });
}

export function leadsGeneratedSeries(leads: Lead[], monthsBack = 6) {
  const months = lastNMonths(monthsBack);
  return months.map(({ key, label, year, month }) => {
    const count = leads.filter((l) => {
      const d = new Date(l.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
    return { month: label, key, leads: count };
  });
}

export function leadsBySource(leads: Lead[]) {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const source = l.source?.trim() || "Unknown";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export function dealsWonLostSeries(leads: LeadWithStage[], monthsBack = 6) {
  const months = lastNMonths(monthsBack);
  return months.map(({ key, label, year, month }) => {
    const inMonth = leads.filter((l) => {
      const d = new Date(l.updatedAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      month: label,
      key,
      won: inMonth.filter((l) => l.stage.isWon).length,
      lost: inMonth.filter((l) => l.stage.isLost).length,
    };
  });
}

export function clientRevenueSeries(invoices: InvoiceWithClient[], topN = 8) {
  const totals = new Map<string, { name: string; revenue: number }>();
  for (const inv of invoices) {
    if (inv.status !== "PAID") continue;
    const existing = totals.get(inv.clientId) ?? { name: inv.client.companyName, revenue: 0 };
    existing.revenue += inv.amount;
    totals.set(inv.clientId, existing);
  }
  return Array.from(totals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, topN);
}

export function contentDeliveredSeries(deliverables: DeliverableWithStatus[], monthsBack = 6) {
  const months = lastNMonths(monthsBack);
  return months.map(({ key, label, year, month }) => {
    const count = deliverables.filter((d) => {
      if (!d.status.isTerminal) return false;
      const ref = new Date(d.updatedAt);
      return ref.getFullYear() === year && ref.getMonth() === month;
    }).length;
    return { month: label, key, delivered: count };
  });
}

export function conversionFunnel(leads: LeadWithStage[], clientCount: number) {
  return [
    { stage: "Total Leads", value: leads.length },
    { stage: "Won", value: leads.filter((l) => l.stage.isWon).length },
    { stage: "Converted to Client", value: clientCount },
  ];
}
