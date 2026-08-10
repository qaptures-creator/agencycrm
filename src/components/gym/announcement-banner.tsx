import { prisma } from "@/lib/prisma";
import { AnnouncementBannerDismiss } from "./announcement-banner-dismiss";

/** Fetches the single most-relevant announcement (pinned first, else most
 * recent) and renders a dismissible-looking banner. Renders nothing if there
 * are no announcements. Used on the dashboard so staff see it on login. */
export async function AnnouncementBanner() {
  const announcement = await prisma.gymAnnouncement.findFirst({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  if (!announcement) return null;

  return <AnnouncementBannerDismiss title={announcement.title} body={announcement.body} pinned={announcement.pinned} />;
}
