"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { invoiceSchema, type InvoiceInput } from "@/lib/validators";

function revalidateAll(clientId: string) {
  revalidatePath("/finance");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
  revalidatePath("/analytics");
}

export async function createInvoice(input: InvoiceInput) {
  const data = invoiceSchema.parse(input);
  const invoice = await prisma.invoice.create({ data });
  revalidateAll(data.clientId);
  return invoice;
}

export async function updateInvoice(id: string, input: InvoiceInput) {
  const data = invoiceSchema.parse(input);
  const invoice = await prisma.invoice.update({ where: { id }, data });
  revalidateAll(data.clientId);
  return invoice;
}

export async function updateInvoiceStatus(id: string, status: string) {
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status, paidDate: status === "PAID" ? new Date() : undefined },
  });
  revalidateAll(invoice.clientId);
  return invoice;
}

export async function deleteInvoice(id: string) {
  const invoice = await prisma.invoice.delete({ where: { id } });
  revalidateAll(invoice.clientId);
}
