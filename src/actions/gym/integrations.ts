"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";

/**
 * Manual connect/disconnect toggle — ONLY valid for providers that represent
 * "we've administratively wired something up" rather than a real OAuth/API
 * connection. Restricted to WEBSITE. EMAIL and ASHBOURNE must never be
 * toggled here — see src/lib/gym/integrations/email-provider.ts for why.
 */
const MANUALLY_TOGGLEABLE_PROVIDERS = new Set(["WEBSITE"]);

export async function toggleIntegrationConnectionAction(provider: string, connect: boolean) {
  const user = await assertPermission("manageIntegrations");

  if (!MANUALLY_TOGGLEABLE_PROVIDERS.has(provider)) {
    throw new Error("This integration can't be manually toggled — it requires a real provider implementation.");
  }

  const integration = await prisma.gymIntegration.update({
    where: { provider },
    data: {
      status: connect ? "CONNECTED" : "NOT_CONNECTED",
      connectedAt: connect ? new Date() : null,
    },
  });

  await logAudit({
    userId: user.id,
    action: connect ? "INTEGRATION_CONNECTED" : "INTEGRATION_DISCONNECTED",
    entityType: "GymIntegration",
    entityId: integration.id,
    metadata: { provider },
  });

  revalidatePath("/gym/integrations");
  return integration;
}
