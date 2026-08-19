"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { syncAshbourneMembers, type SyncOutcome } from "@/lib/ashbourne/sync";
import { getAshbourneDiagnosticEnvSummary } from "@/lib/ashbourne/config";

/** Admin-only. Retrieves and matches Ashbourne members but writes nothing —
 * see Phase 10: real syncs are never run until a dry run has been reviewed. */
export async function dryRunAshbourneSyncAction(): Promise<SyncOutcome> {
  const user = await assertPermission("manageIntegrations");
  const result = await syncAshbourneMembers({ dryRun: true });

  await logAudit({
    userId: user.id,
    action: "ASHBOURNE_DRY_RUN",
    entityType: "GymAshbourneSyncLog",
    metadata: { recordsFound: result.recordsFound, created: result.created, updated: result.updated, reviewRequired: result.reviewRequired },
  });

  return result;
}

/** Admin-only. Runs the real sync — creates/updates GymMember rows. */
export async function syncAshbourneMembersAction(): Promise<SyncOutcome> {
  const user = await assertPermission("manageIntegrations");
  const result = await syncAshbourneMembers({ dryRun: false });

  await logAudit({
    userId: user.id,
    action: "ASHBOURNE_SYNC_RUN",
    entityType: "GymAshbourneSyncLog",
    metadata: { recordsFound: result.recordsFound, created: result.created, updated: result.updated, reviewRequired: result.reviewRequired, failed: result.failed },
  });

  revalidatePath("/gym/members");
  revalidatePath("/gym/integrations");
  revalidatePath("/gym");
  return result;
}

export async function getAshbourneStatusAction() {
  await assertPermission("manageIntegrations");
  const [envSummary, lastLog] = await Promise.all([
    getAshbourneDiagnosticEnvSummary(),
    prisma.gymAshbourneSyncLog.findFirst({ orderBy: { startedAt: "desc" }, where: { dryRun: false } }),
  ]);
  return { envSummary, lastLog };
}
