import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Sidebar nav badge counts — shown as "(+N)" next to a section's label.
 * Each one reuses an existing field/log rather than adding new per-user
 * "seen/unseen" tracking:
 *  - Enquiries: status === "NEW" (same definition as the existing "Unread"
 *    tab on the Enquiries page) — a live "needs attention" count.
 *  - Members: the most recent real (non-dry-run) Ashbourne sync's
 *    `created` count — how many new members that sync brought in. Updates
 *    each time a sync runs; a sync that creates nothing makes it disappear.
 *  - Shake Bar: the most recent manual "Sync SumUp" run's imported sales
 *    count (GymPosSyncState.lastSalesSyncImportedCount) — same idea,
 *    mirrors the Ashbourne pattern.
 */
export type NavBadgeCounts = {
  "/gym/enquiries": number;
  "/gym/members": number;
  "/gym/shake-bar": number;
};

export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  const [newEnquiries, lastAshbourneSync, posSyncState] = await Promise.all([
    prisma.gymEnquiry.count({ where: { status: "NEW" } }),
    prisma.gymAshbourneSyncLog.findFirst({
      where: { dryRun: false },
      orderBy: { startedAt: "desc" },
      select: { created: true },
    }),
    prisma.gymPosSyncState.findUnique({
      where: { key: "goodtill" },
      select: { lastSalesSyncImportedCount: true },
    }),
  ]);

  return {
    "/gym/enquiries": newEnquiries,
    "/gym/members": lastAshbourneSync?.created ?? 0,
    "/gym/shake-bar": posSyncState?.lastSalesSyncImportedCount ?? 0,
  };
}
