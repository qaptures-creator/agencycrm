import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Sidebar nav badge counts — shown as "(+N)" next to a section's label.
 * Clears the moment the user visits that section (see markNavSectionSeen,
 * called from each section's page.tsx), tracked per-user via
 * GymNavBadgeSeen rather than mutating any real business state (an
 * enquiry's status, a member's fields, etc. are never touched just because
 * someone looked at the list).
 *
 *  - Enquiries: count of status === "NEW" enquiries created since this
 *    user's last visit to /gym/enquiries.
 *  - Members: the most recent real (non-dry-run) Ashbourne sync's
 *    `created` count — shown only if that sync happened after this user's
 *    last visit to /gym/members.
 *  - Shake Bar: the most recent manual "Sync SumUp" run's imported sales
 *    count — shown only if that sync happened after this user's last
 *    visit to /gym/shake-bar.
 */
export type NavBadgeCounts = {
  "/gym/enquiries": number;
  "/gym/members": number;
  "/gym/shake-bar": number;
};

const SECTIONS = ["/gym/enquiries", "/gym/members", "/gym/shake-bar"] as const;
const NEVER_SEEN = new Date(0);

export async function getNavBadgeCounts(userId: string): Promise<NavBadgeCounts> {
  const [seenRows, lastAshbourneSync, posSyncState] = await Promise.all([
    prisma.gymNavBadgeSeen.findMany({
      where: { userId, section: { in: [...SECTIONS] } },
      select: { section: true, seenAt: true },
    }),
    prisma.gymAshbourneSyncLog.findFirst({
      where: { dryRun: false },
      orderBy: { startedAt: "desc" },
      select: { created: true, startedAt: true },
    }),
    prisma.gymPosSyncState.findUnique({
      where: { key: "goodtill" },
      select: { lastSalesSyncImportedCount: true, lastSalesSyncAt: true },
    }),
  ]);

  const seenAt = new Map(seenRows.map((r) => [r.section, r.seenAt]));
  const membersSeenAt = seenAt.get("/gym/members") ?? NEVER_SEEN;
  const shakeBarSeenAt = seenAt.get("/gym/shake-bar") ?? NEVER_SEEN;
  const enquiriesSeenAt = seenAt.get("/gym/enquiries") ?? NEVER_SEEN;

  const membersCount = lastAshbourneSync && lastAshbourneSync.startedAt > membersSeenAt ? (lastAshbourneSync.created ?? 0) : 0;
  const shakeBarCount =
    posSyncState?.lastSalesSyncAt && posSyncState.lastSalesSyncAt > shakeBarSeenAt ? (posSyncState.lastSalesSyncImportedCount ?? 0) : 0;

  const newEnquiries = await prisma.gymEnquiry.count({ where: { status: "NEW", createdAt: { gt: enquiriesSeenAt } } });

  return {
    "/gym/enquiries": newEnquiries,
    "/gym/members": membersCount,
    "/gym/shake-bar": shakeBarCount,
  };
}

/** Called from a section's page.tsx on every visit — marks "seen" as now,
 * clearing that section's badge. Fire-and-forget is fine: this is a
 * best-effort UI nicety, not something that needs to block rendering or be
 * guaranteed durable. */
export function markNavSectionSeen(userId: string, section: (typeof SECTIONS)[number]) {
  prisma.gymNavBadgeSeen
    .upsert({
      where: { userId_section: { userId, section } },
      create: { userId, section, seenAt: new Date() },
      update: { seenAt: new Date() },
    })
    .catch(() => {});
}
