import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type SearchResult = {
  id: string;
  type: "Lead" | "Client" | "Contact" | "Project" | "Deliverable";
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [leads, clients, projects, deliverables] = await Promise.all([
    prisma.lead.findMany({
      where: {
        OR: [
          { companyName: { contains: q } },
          { contactName: { contains: q } },
          { email: { contains: q } },
          { instagram: { contains: q } },
        ],
      },
      take: 6,
    }),
    prisma.client.findMany({
      where: {
        OR: [
          { companyName: { contains: q } },
          { mainContactName: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: 6,
    }),
    prisma.project.findMany({
      where: { name: { contains: q } },
      include: { client: true },
      take: 6,
    }),
    prisma.deliverable.findMany({
      where: {
        OR: [{ customTypeName: { contains: q } }, { notes: { contains: q } }],
      },
      include: { client: true },
      take: 6,
    }),
  ]);

  const results: SearchResult[] = [
    ...leads.map((l) => ({
      id: l.id,
      type: "Lead" as const,
      title: l.companyName,
      subtitle: `${l.contactName}${l.email ? ` · ${l.email}` : ""}`,
      href: `/crm?lead=${l.id}`,
    })),
    ...clients.map((c) => ({
      id: c.id,
      type: "Client" as const,
      title: c.companyName,
      subtitle: c.mainContactName,
      href: `/clients/${c.id}`,
    })),
    ...clients
      .filter((c) => c.mainContactName.toLowerCase().includes(q.toLowerCase()))
      .map((c) => ({
        id: `${c.id}-contact`,
        type: "Contact" as const,
        title: c.mainContactName,
        subtitle: `Contact at ${c.companyName}`,
        href: `/clients/${c.id}`,
      })),
    ...projects.map((p) => ({
      id: p.id,
      type: "Project" as const,
      title: p.name,
      subtitle: p.client.companyName,
      href: `/projects?project=${p.id}`,
    })),
    ...deliverables.map((d) => ({
      id: d.id,
      type: "Deliverable" as const,
      title: d.customTypeName || d.contentType,
      subtitle: d.client.companyName,
      href: `/deliverables?deliverable=${d.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
