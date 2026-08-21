import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Sidebar nav badge counts — small, actionable "needs attention" numbers
 * shown next to a section's nav item, not a general activity feed. Each one
 * reuses an existing field and naturally clears itself as staff resolve the
 * underlying thing, rather than requiring separate per-user "seen/unseen"
 * tracking:
 *  - Members: reviewRequired === true (set by the Ashbourne sync when it
 *    can't confidently match a record to an existing member).
 *  - Shake Bar: GymPosWebhookEvent.status === "ERROR" (a SumUp webhook that
 *    failed to process).
 *
 * Enquiries previously showed a count of status === "NEW" here — removed
 * per request, it was more noise than signal on that section.
 */
export type NavBadgeCounts = {
  "/gym/members": number;
  "/gym/shake-bar": number;
};

export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  const [membersNeedingReview, posWebhookErrors] = await Promise.all([
    prisma.gymMember.count({ where: { reviewRequired: true } }),
    prisma.gymPosWebhookEvent.count({ where: { status: "ERROR" } }),
  ]);

  return {
    "/gym/members": membersNeedingReview,
    "/gym/shake-bar": posWebhookErrors,
  };
}
