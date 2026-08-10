import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { navItemsForRole } from "@/lib/gym/nav-config";
import type { GymAccessRole } from "@/lib/gym/permissions";

export type GymSearchResult = {
  id: string;
  type: "Member" | "Enquiry" | "Lead" | "Staff" | "Equipment" | "Task";
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const allowed = new Set(navItemsForRole(user.accessRole as GymAccessRole).map((i) => i.href));
  const insensitive = { contains: q, mode: "insensitive" as const };

  const [members, enquiries, leads, staff, equipment, tasks] = await Promise.all([
    allowed.has("/gym/members")
      ? prisma.gymMember.findMany({
          where: { OR: [{ fullName: insensitive }, { email: insensitive }, { phone: insensitive }, { memberNumber: insensitive }] },
          take: 6,
        })
      : [],
    prisma.gymEnquiry.findMany({
      where: { OR: [{ name: insensitive }, { email: insensitive }, { subject: insensitive }] },
      take: 6,
    }),
    allowed.has("/gym/leads")
      ? prisma.gymLead.findMany({ where: { OR: [{ name: insensitive }, { email: insensitive }] }, take: 6 })
      : [],
    allowed.has("/gym/staff")
      ? prisma.gymStaff.findMany({ where: { OR: [{ fullName: insensitive }, { email: insensitive }, { position: insensitive }] }, take: 6 })
      : [],
    prisma.gymEquipment.findMany({ where: { OR: [{ name: insensitive }, { location: insensitive }] }, take: 6 }),
    prisma.gymTask.findMany({ where: { title: insensitive }, take: 6 }),
  ]);

  const results: GymSearchResult[] = [
    ...members.map((m) => ({
      id: m.id,
      type: "Member" as const,
      title: m.fullName,
      subtitle: m.memberNumber,
      href: `/gym/members/${m.id}`,
    })),
    ...enquiries.map((e) => ({
      id: e.id,
      type: "Enquiry" as const,
      title: e.name,
      subtitle: e.subject || e.category,
      href: `/gym/enquiries?enquiry=${e.id}`,
    })),
    ...leads.map((l) => ({
      id: l.id,
      type: "Lead" as const,
      title: l.name,
      subtitle: l.stage.replace(/_/g, " "),
      href: `/gym/leads?lead=${l.id}`,
    })),
    ...staff.map((s) => ({
      id: s.id,
      type: "Staff" as const,
      title: s.fullName,
      subtitle: s.position,
      href: `/gym/staff/${s.id}`,
    })),
    ...equipment.map((eq) => ({
      id: eq.id,
      type: "Equipment" as const,
      title: eq.name,
      subtitle: eq.location || eq.category,
      href: `/gym/equipment?equipment=${eq.id}`,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      type: "Task" as const,
      title: t.title,
      subtitle: t.category.replace(/_/g, " "),
      href: `/gym/tasks?task=${t.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
