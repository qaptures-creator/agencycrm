import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { proposalContentSchema, type ProposalLayout } from "@/lib/proposal-types";
import { isValidPdfInternalToken, PDF_INTERNAL_TOKEN_HEADER } from "@/lib/pdf/internal-token";
import { ProposalDocument } from "@/components/proposal/proposal-document";

export const dynamic = "force-dynamic";

// Rendered only by our own PDF route (src/app/api/proposals/[id]/pdf) — never
// linked to from the app UI. Gated by an in-process token so this print-only
// view of a proposal isn't reachable by anyone just guessing the URL.
export default async function ProposalPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const requestHeaders = await headers();
  if (!isValidPdfInternalToken(requestHeaders.get(PDF_INTERNAL_TOKEN_HEADER))) notFound();

  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { client: { select: { companyName: true, color: true } } },
  });
  if (!proposal) notFound();

  const parsedContent = proposalContentSchema.safeParse(proposal.content);
  if (!parsedContent.success) notFound();

  const layout: ProposalLayout = proposal.layout === "DECK" ? "DECK" : "DOCUMENT";
  const pageSize = layout === "DECK" ? "A4 landscape" : "A4 portrait";

  return (
    <>
      {/* preferCSSPageSize (set in the PDF route) makes this rule authoritative
          for Puppeteer's page.pdf() — without it Chromium falls back to a
          default page size that doesn't match the 210mm/297mm section boxes
          below, and pagination goes out of sync with the content. */}
      <style>{`@page { size: ${pageSize}; margin: 0; }`}</style>
      <ProposalDocument client={proposal.client} layout={layout} content={parsedContent.data} mode="print" />
    </>
  );
}
