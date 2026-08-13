"use server";

import { revalidatePath } from "next/cache";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { reconcileGoodtillSync } from "@/lib/gym/integrations/goodtill-sync";

/** Manual "Sync SumUp" button — refreshes the full product/category mirror
 * and reconciles the last 14 days of sales in case any webhook was missed.
 * Full historical backfill is a separate one-off, not part of this action. */
export async function syncGoodtillAction() {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");

  const result = await reconcileGoodtillSync({ lookbackDays: 14 });

  await logAudit({
    userId: user.id,
    action: "GOODTILL_MANUAL_SYNC",
    entityType: "GymPosSyncState",
    metadata: result,
  });
  revalidatePath("/gym/shake-bar");
  return result;
}
