import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { LeadsView } from "./leads-view";
import type { LeadDetail } from "./lead-detail-sheet";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ lead?: string; new?: string }> }) {
  await requireGymUser();
  const { lead: selectedId } = await searchParams;

  const [leadsRaw, staff, total, joined, selectedRaw] = await Promise.all([
    prisma.gymLead.findMany({ orderBy: { createdAt: "desc" }, include: { assignedTo: true } }),
    prisma.gymStaff.findMany({ where: { employmentStatus: { not: "Former" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.gymLead.count(),
    prisma.gymLead.count({ where: { stage: "JOINED" } }),
    selectedId
      ? prisma.gymLead.findUnique({
          where: { id: selectedId },
          include: { activities: { orderBy: { createdAt: "desc" }, include: { createdBy: true } } },
        })
      : null,
  ]);

  const leads = leadsRaw.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    membershipInterest: l.membershipInterest,
    source: l.source,
    stage: l.stage,
    nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
    nextFollowUpAtRaw: l.nextFollowUpAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    assignedTo: l.assignedTo ? { fullName: l.assignedTo.fullName } : null,
  }));

  const selected: LeadDetail | null = selectedRaw
    ? {
        id: selectedRaw.id,
        name: selectedRaw.name,
        email: selectedRaw.email,
        phone: selectedRaw.phone,
        source: selectedRaw.source,
        membershipInterest: selectedRaw.membershipInterest,
        assignedToId: selectedRaw.assignedToId,
        stage: selectedRaw.stage,
        nextFollowUpAt: selectedRaw.nextFollowUpAt,
        activities: selectedRaw.activities.map((a) => ({
          id: a.id,
          type: a.type,
          notes: a.notes,
          createdAt: a.createdAt.toISOString(),
          createdByName: a.createdBy?.name ?? null,
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">Membership sales pipeline — from first contact to joined.</p>
      </div>
      <LeadsView
        leads={leads}
        staff={staff}
        stats={{ total, joined, conversionRate: total > 0 ? (joined / total) * 100 : 0 }}
        selected={selected}
      />
    </div>
  );
}
