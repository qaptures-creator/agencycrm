import { prisma } from "@/lib/prisma";
import { FinanceView } from "./finance-view";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [invoices, clients, leads] = await Promise.all([
    prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, include: { client: true } }),
    prisma.client.findMany({ orderBy: { companyName: "asc" }, include: { retainer: true } }),
    prisma.lead.findMany({ include: { stage: true } }),
  ]);

  return <FinanceView invoices={invoices} clients={clients} leads={leads} />;
}
