"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { paymentSchema, type PaymentInput } from "@/lib/gym/validators";
import { assertPermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { notifyManagement } from "@/lib/gym/notify";

export async function createPaymentAction(input: PaymentInput) {
  const user = await assertPermission("viewFinance");
  const data = paymentSchema.parse(input);

  const payment = await prisma.gymPayment.create({
    data: {
      memberId: data.memberId,
      transactionRef: data.transactionRef,
      date: data.date ?? new Date(),
      amount: data.amount,
      type: data.type,
      status: data.status,
      provider: data.provider,
    },
    include: { member: true },
  });

  if (payment.status === "FAILED") {
    await notifyManagement({
      type: "PAYMENT_FAILED",
      title: `Failed payment — ${payment.member?.fullName ?? "Unknown member"}`,
      body: `£${payment.amount.toFixed(2)}`,
      link: "/gym/payments",
    });
  }

  await logAudit({ userId: user.id, action: "PAYMENT_RECORDED", entityType: "GymPayment", entityId: payment.id });
  revalidatePath("/gym/payments");
  revalidatePath("/gym/finances");
  revalidatePath("/gym");
  if (data.memberId) revalidatePath(`/gym/members/${data.memberId}`);
  return payment;
}

export async function setPaymentStatusAction(id: string, status: string) {
  const user = await assertPermission("viewFinance");

  const payment = await prisma.gymPayment.update({ where: { id }, data: { status }, include: { member: true } });

  if (status === "FAILED") {
    await notifyManagement({
      type: "PAYMENT_FAILED",
      title: `Failed payment — ${payment.member?.fullName ?? "Unknown member"}`,
      body: `£${payment.amount.toFixed(2)}`,
      link: "/gym/payments",
    });
  }

  await logAudit({ userId: user.id, action: "PAYMENT_STATUS_CHANGED", entityType: "GymPayment", entityId: id, metadata: { status } });
  revalidatePath("/gym/payments");
  revalidatePath("/gym/finances");
  revalidatePath("/gym");
  if (payment.memberId) revalidatePath(`/gym/members/${payment.memberId}`);
  return payment;
}
