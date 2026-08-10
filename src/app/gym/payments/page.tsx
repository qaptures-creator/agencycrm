import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/gym/auth";
import { isAshbourneConnected } from "@/lib/gym/integrations/ashbourne-provider";
import { PaymentList, type PaymentRow } from "./payment-list";

export default async function PaymentsPage() {
  await requirePermission("viewFinance");

  const [paymentsRaw, members, ashbourneConnected] = await Promise.all([
    prisma.gymPayment.findMany({
      orderBy: { date: "desc" },
      include: { member: true },
      take: 200,
    }),
    prisma.gymMember.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, memberNumber: true } }),
    isAshbourneConnected(),
  ]);

  const payments: PaymentRow[] = paymentsRaw.map((p) => ({
    id: p.id,
    transactionRef: p.transactionRef,
    date: p.date.toISOString(),
    amount: p.amount,
    type: p.type,
    status: p.status,
    provider: p.provider,
    member: p.member ? { id: p.member.id, fullName: p.member.fullName } : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">Real payment records — no fabricated transactions.</p>
      </div>

      {!ashbourneConnected && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-warning-foreground">Ashbourne Membership Management isn&apos;t connected</p>
          <p className="mt-1 text-muted-foreground">
            Showing manually-entered payments only. Connect Ashbourne in{" "}
            <a href="/gym/integrations" className="text-primary hover:underline">
              Settings → Integrations
            </a>{" "}
            once API access is available to pull transactions in automatically.
          </p>
        </div>
      )}

      <PaymentList payments={payments} members={members} />
    </div>
  );
}
