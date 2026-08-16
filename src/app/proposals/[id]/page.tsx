import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { proposalContentSchema, type ProposalLayout } from "@/lib/proposal-types";
import { ProposalWorkspace } from "./proposal-workspace";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { client: { select: { id: true, companyName: true, color: true } } },
  });
  if (!proposal) notFound();

  const parsedContent = proposalContentSchema.safeParse(proposal.content);
  if (!parsedContent.success) notFound();

  const layout: ProposalLayout = proposal.layout === "DECK" ? "DECK" : "DOCUMENT";

  return (
    <ProposalWorkspace
      proposal={{ id: proposal.id, title: proposal.title, layout, content: parsedContent.data }}
      client={proposal.client}
    />
  );
}
