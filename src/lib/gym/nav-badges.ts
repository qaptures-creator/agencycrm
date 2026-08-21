import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Sidebar nav badge counts — small, actionable "needs attention" numbers
 * shown next to a section's nav item, not a general activity feed. Each one
 * reuses an existing field and naturally clears itself as staff resolve the
 * underlying thing, rather than requiring separate per-user "seen/unseen"
 * tracking:
 *  - Enquiries: status === "NEW" (same definition as the existing "Unread"
 *    tab on the Enquiries page).
 *  - Members: reviewRequired === true (set by the Ashbourne sync when it
 *    can't confidently match a record to an existing member).
 *  - Shake Bar: GymPosWebhookEvent.status === "ERROR" (a SumUp webhook that
 *    failed to process).
 */
export type NavBadgeCounts = {
  "/gym/enquiries": number;
  "/gym/members": number;
  "/gym/shake-bar": number;
};

export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  const [newEnquiries, membersNeedingReview, posWebhookErrors] = await Promise.all([
    prisma.gymEnquiry.count({ where: { status: "NEW" } }),
    prisma.gymMember.count({ where: { reviewRequired: true } }),
    prisma.gymPosWebhookEvent.count({ where: { status: "ERROR" } }),
  ]);

  return {
    "/gym/enquiries": newEnquiries,
    "/gym/members": membersNeedingReview,
    "/gym/shake-bar": posWebhookErrors,
  };
}
