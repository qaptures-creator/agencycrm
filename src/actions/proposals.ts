"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { proposalContentSchema, createDefaultProposalContent, type ProposalContent, type ProposalLayout } from "@/lib/proposal-types";

export async function createProposal({ clientId, title, layout }: { clientId: string; title: string; layout: ProposalLayout }) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { services: true } });
  if (!client) throw new Error("Client not found");

  const proposal = await prisma.proposal.create({
    data: {
      clientId,
      title: title.trim() || `Proposal for ${client.companyName}`,
      layout,
      content: createDefaultProposalContent(client),
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return proposal;
}

export async function updateProposal(
  id: string,
  input: { title: string; layout: ProposalLayout; content: ProposalContent }
) {
  const content = proposalContentSchema.parse(input.content);
  const proposal = await prisma.proposal.update({
    where: { id },
    data: { title: input.title.trim(), layout: input.layout, content },
  });

  revalidatePath(`/proposals/${id}`);
  revalidatePath(`/clients/${proposal.clientId}`);
  return proposal;
}

export async function deleteProposal(id: string) {
  const proposal = await prisma.proposal.delete({ where: { id } });
  revalidatePath(`/clients/${proposal.clientId}`);
  return proposal;
}
