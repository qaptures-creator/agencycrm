import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { isAshbourneConnected } from "@/lib/gym/integrations/ashbourne-provider";
import { PlanList, type PlanRow } from "./plan-list";
import { CsvTools, type ExportMemberRow } from "./csv-tools";

export default async function MembershipsPage() {
  const user = await requireGymUser();
  const canManage = can(user.accessRole as GymAccessRole, "manageMemberships");

  const [plans, activeCounts, ashbourneConnected, membersRaw] = await Promise.all([
    prisma.gymMembershipPlan.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.gymMembership.groupBy({ by: ["planId"], where: { status: "ACTIVE" }, _count: true }),
    isAshbourneConnected(),
    prisma.gymMember.findMany({
      orderBy: { createdAt: "desc" },
      include: { memberships: { orderBy: { startDate: "desc" }, take: 1, include: { plan: true } } },
    }),
  ]);

  const countByPlan = new Map(activeCounts.map((c) => [c.planId, c._count]));

  const planRows: PlanRow[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    billingFrequency: p.billingFrequency,
    joiningFee: p.joiningFee,
    contractLengthMonths: p.contractLengthMonths,
    description: p.description,
    active: p.active,
    activeMemberCount: countByPlan.get(p.id) ?? 0,
  }));

  const exportRows: ExportMemberRow[] = membersRaw.map((m) => {
    const membership = m.memberships[0] ?? null;
    return {
      memberNumber: m.memberNumber,
      fullName: m.fullName,
      email: m.email,
      phone: m.phone,
      joinDate: m.joinDate.toISOString().slice(0, 10),
      planName: membership?.plan.name ?? null,
      billingAmount: membership?.billingAmount ?? null,
      paymentFrequency: membership?.paymentFrequency ?? null,
      status: membership?.status ?? null,
      renewalDate: membership?.renewalDate ? membership.renewalDate.toISOString().slice(0, 10) : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Memberships</h1>
        <p className="text-sm text-muted-foreground">Membership plan catalog, pricing and member counts.</p>
      </div>

      {!ashbourneConnected && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-warning-foreground">Ashbourne Not Connected</p>
          <p className="mt-1 text-muted-foreground">
            Ashbourne Membership Management isn&apos;t connected yet, so plans and members below are managed manually
            in this CRM. Connect it in{" "}
            <a href="/gym/integrations" className="text-primary hover:underline">
              Settings → Integrations
            </a>{" "}
            once API access is available.
          </p>
        </div>
      )}

      <PlanList plans={planRows} canManage={canManage} />

      <CsvTools members={exportRows} canManage={canManage} />
    </div>
  );
}
