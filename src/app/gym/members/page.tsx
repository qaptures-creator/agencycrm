import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MemberList, type MemberRow } from "./member-list";
import { MemberMapView } from "./member-map-view";

export default async function MembersPage() {
  const user = await requireGymUser();
  const canImport = can(user.accessRole as GymAccessRole, "manageMemberships");

  const [membersRaw, plans] = await Promise.all([
    prisma.gymMember.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: { orderBy: { startDate: "desc" }, take: 1, include: { plan: true } },
      },
    }),
    prisma.gymMembershipPlan.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

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

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <MemberList members={members} canImport={canImport} />
        </TabsContent>

        <TabsContent value="map">
          <MemberMapView plans={plans} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
