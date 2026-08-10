import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentCalendar } from "./content-calendar";
import { CampaignTracker } from "./campaign-tracker";
import { LeadsBySource } from "./leads-by-source";

export default async function MarketingPage() {
  const user = await requirePermission("viewMarketing");
  const canManage = can(user.accessRole as GymAccessRole, "manageMarketing");

  const [content, staff, campaigns, leadsBySource] = await Promise.all([
    prisma.gymMarketingContent.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: { owner: { select: { id: true, fullName: true } } },
    }),
    prisma.gymStaff.findMany({
      where: { employmentStatus: { not: "Former" } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.gymMarketingCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { leads: { select: { id: true, stage: true } } },
    }),
    prisma.gymLead.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);

  const joinedBySource = await prisma.gymLead.groupBy({
    by: ["source"],
    where: { stage: "JOINED" },
    _count: { _all: true },
  });
  const joinedMap = new Map(joinedBySource.map((r) => [r.source, r._count._all]));

  const leadSourceRows = leadsBySource
    .map((r) => ({
      source: r.source,
      count: r._count._all,
      joined: joinedMap.get(r.source) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const campaignRows = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    notes: c.notes,
    leadCount: c.leads.length,
    joinedCount: c.leads.filter((l) => l.stage === "JOINED").length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Marketing</h1>
        <p className="text-sm text-muted-foreground">Content calendar, lead source performance, and campaign tracking.</p>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content Calendar</TabsTrigger>
          <TabsTrigger value="leads">Marketing Leads</TabsTrigger>
          <TabsTrigger value="campaigns">Campaign Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <ContentCalendar
            content={content.map((c) => ({
              id: c.id,
              title: c.title,
              platform: c.platform,
              shootDate: c.shootDate,
              publishDate: c.publishDate,
              status: c.status,
              notes: c.notes,
              owner: c.owner,
            }))}
            staff={staff}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="leads">
          <LeadsBySource rows={leadSourceRows} />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignTracker campaigns={campaignRows} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
