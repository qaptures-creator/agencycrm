import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { isEmailIntegrationConnected } from "@/lib/gym/integrations/email-provider";
import { markNavSectionSeen } from "@/lib/gym/nav-badges";
import { EnquiryInbox } from "./enquiry-inbox";
import type { EnquiryDetail } from "./enquiry-detail-sheet";

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ enquiry?: string; new?: string }> }) {
  const user = await requireGymUser();
  markNavSectionSeen(user.id, "/gym/enquiries");
  const { enquiry: selectedId } = await searchParams;

  const [enquiries, staff, emailConnected, selectedRaw] = await Promise.all([
    prisma.gymEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      include: { assignedTo: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.gymStaff.findMany({ where: { employmentStatus: { not: "Former" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    isEmailIntegrationConnected(),
    selectedId
      ? prisma.gymEnquiry.findUnique({
          where: { id: selectedId },
          include: { messages: { orderBy: { createdAt: "asc" }, include: { author: true } } },
        })
      : null,
  ]);

  const selected: EnquiryDetail | null = selectedRaw
    ? {
        id: selectedRaw.id,
        name: selectedRaw.name,
        email: selectedRaw.email,
        phone: selectedRaw.phone,
        subject: selectedRaw.subject,
        category: selectedRaw.category,
        status: selectedRaw.status,
        priority: selectedRaw.priority,
        source: selectedRaw.source,
        followUpAt: selectedRaw.followUpAt?.toISOString() ?? null,
        createdAt: selectedRaw.createdAt.toISOString(),
        assignedToId: selectedRaw.assignedToId,
        convertedMemberId: selectedRaw.convertedMemberId,
        messages: selectedRaw.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          authorName: m.author?.name ?? null,
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Enquiries</h1>
        <p className="text-sm text-muted-foreground">Customer enquiries, eventually fed live from admin@musclemassacre.com.</p>
      </div>

      <EnquiryInbox
        enquiries={enquiries.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          phone: e.phone,
          subject: e.subject,
          category: e.category,
          status: e.status,
          priority: e.priority,
          createdAt: e.createdAt.toISOString(),
          assignedToId: e.assignedToId,
          assignedTo: e.assignedTo ? { fullName: e.assignedTo.fullName } : null,
          preview: e.messages[0]?.body.slice(0, 120) ?? null,
        }))}
        staff={staff}
        currentStaffId={user.staff?.id ?? null}
        selected={selected}
        emailConnected={emailConnected}
      />
    </div>
  );
}
