import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { markNavSectionSeen } from "@/lib/gym/nav-badges";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { parseMemberListFilters, getFilteredMembers, getDistinctMembershipTypes } from "@/lib/gym/member-filters";
import { MemberList } from "./member-list";
import { MemberMapView } from "./member-map-view";
import { MemberSectionNav } from "./member-section-nav";

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireTabAccess("/gym/members");
  const canImport = can(user.accessRole as GymAccessRole, "manageMemberships");
  markNavSectionSeen(user.id, "/gym/members");

  const sp = await searchParams;
  const filters = parseMemberListFilters(sp);

  const [{ rows: members, total }, membershipTypes, plans] = await Promise.all([
    getFilteredMembers(filters),
    getDistinctMembershipTypes(),
    prisma.gymMembershipPlan.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground">Member records, membership status and payment health.</p>
      </div>

      <MemberSectionNav />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <MemberList members={members} total={total} filters={filters} membershipTypes={membershipTypes} canImport={canImport} />
        </TabsContent>

        <TabsContent value="map">
          <MemberMapView plans={plans} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
