import Link from "next/link";
import { ListChecks, Dumbbell, Wrench, SprayCan, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOwnAttendanceStatus } from "@/actions/gym/attendance";
import { ClockInOutCard } from "@/components/gym/clock-in-out-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskQuickComplete } from "@/components/gym/dashboard/task-quick-complete";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/** Staff-first mobile home: My Shift, My Tasks, quick actions. Shown only on
 * small screens (lg:hidden) above the regular manager-oriented dashboard,
 * which stays reachable by scrolling — managers keep full CRM access. */
export async function MobileStaffHome({ userId, staffId }: { userId: string; staffId: string | null }) {
  if (!staffId) return null;

  const [attendance, myTasks] = await Promise.all([
    getOwnAttendanceStatus(),
    prisma.gymTask.findMany({
      where: { assignedToId: staffId, status: { not: "COMPLETED" } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-4 lg:hidden">
      {attendance && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Shift</p>
          <ClockInOutCard
            clockedIn={attendance.clockedIn}
            clockInAt={attendance.clockInAt?.toISOString() ?? null}
            shiftLabel={
              attendance.todaysShift
                ? `${format(attendance.todaysShift.startTime, "HH:mm")}–${format(attendance.todaysShift.endTime, "HH:mm")}`
                : null
            }
          />
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">My Tasks</CardTitle>
          <Link href="/gym/tasks" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="space-y-1">
          {myTasks.length === 0 && (
            <EmptyState icon={ListChecks} title="Nothing assigned to you" className="border-none bg-transparent py-6" />
          )}
          {myTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/40">
              <TaskQuickComplete taskId={task.id} completed={false} />
              <p className={cn("truncate text-sm font-medium")}>{task.title}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/gym/tasks"
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-4 text-xs font-medium text-foreground/90 hover:border-primary/40"
        >
          <ClipboardList className="size-5 text-primary" />
          Complete Task
        </Link>
        <Link
          href="/gym/equipment?new=1"
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-4 text-xs font-medium text-foreground/90 hover:border-primary/40"
        >
          <Dumbbell className="size-5 text-primary" />
          Report Equipment
        </Link>
        <Link
          href="/gym/cleaning"
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-4 text-xs font-medium text-foreground/90 hover:border-primary/40"
        >
          <SprayCan className="size-5 text-primary" />
          Cleaning Tasks
        </Link>
        <Link
          href="/gym/maintenance?new=1"
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-4 text-xs font-medium text-foreground/90 hover:border-primary/40"
        >
          <Wrench className="size-5 text-primary" />
          Report Maintenance Issue
        </Link>
      </div>

      <div className="border-t border-border pt-1" />
    </div>
  );
}
