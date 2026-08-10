import Link from "next/link";
import { Inbox, ListChecks, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AnnouncementFeed } from "./announcement-feed";
import { startOfWeek } from "date-fns";

export default async function CommunicationsPage() {
  const user = await requireGymUser();
  const canManage = can(user.accessRole as GymAccessRole, "manageStaff");

  const [announcements, newEnquiriesThisWeek, overdueTasks] = await Promise.all([
    prisma.gymAnnouncement.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
      take: 50,
    }),
    prisma.gymEnquiry.count({ where: { createdAt: { gte: startOfWeek(new Date(), { weekStartsOn: 1 }) } } }),
    prisma.gymTask.count({ where: { status: { not: "COMPLETED" }, dueDate: { lt: new Date() } } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Communications</h1>
        <p className="text-sm text-muted-foreground">
          Internal announcements for the whole team. Email, per-record notes and follow-ups live on their own pages —
          this hub covers announcements plus a quick pulse on what needs attention.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnnouncementFeed
            announcements={announcements}
            canManage={canManage}
          />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Link href="/gym/enquiries" className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-secondary/40">
              <span className="flex items-center gap-2">
                <Inbox className="size-4 text-muted-foreground" />
                {newEnquiriesThisWeek} new enquir{newEnquiriesThisWeek === 1 ? "y" : "ies"} this week
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
            <Link href="/gym/tasks" className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-secondary/40">
              <span className="flex items-center gap-2">
                <ListChecks className="size-4 text-muted-foreground" />
                {overdueTasks} task{overdueTasks === 1 ? "" : "s"} overdue
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
