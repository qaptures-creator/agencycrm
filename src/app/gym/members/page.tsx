import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { MemberList, type MemberRow } from "./member-list";

export default async function MembersPage() {
  await requireGymUser();

  const membersRaw = await prisma.gymMember.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: { orderBy: { startDate: "desc" }, take: 1, include: { plan: true } },
    },
  });

  const members: MemberRow[] = membersRaw.map((m) => {
    const membership = m.memberships[0] ?? null;
    return {
      id: m.id,
      memberNumber: m.memberNumber,
      fullName: m.fullName,
      email: m.email,
      phone: m.phone,
      joinDate: m.joinDate.toISOString(),
      lastVisitAt: m.lastVisitAt?.toISOString() ?? null,
      membership: membership
        ? {
            planName: membership.plan.name,
            status: membership.status,
            paymentStatus: membership.paymentStatus,
            renewalDate: membership.renewalDate?.toISOString() ?? null,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground">Member records, membership status and payment health.</p>
      </div>
      <MemberList members={members} />
    </div>
  );
}
