// Audit trail for MCP write operations. Reuses the existing Activity model
// (no schema change) so every ChatGPT-initiated write leaves a visible trace
// in the CRM's own activity feed, e.g. "Lead created through PRMOTE MCP".

import { prisma } from "@/lib/prisma";

export async function auditMcpWrite(params: {
  summary: string;
  leadId?: string;
  clientId?: string;
}) {
  await prisma.activity.create({
    data: {
      type: "NOTE",
      subject: "PRMOTE MCP",
      notes: params.summary,
      leadId: params.leadId,
      clientId: params.clientId,
    },
  });
}
