import "server-only";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek } from "date-fns";

const WEEKDAY_INDEX: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0 };

/** Recurring tasks (DAILY/WEEKLY) are single rows that get marked COMPLETED for
 * "today"/"this week" then need to reappear as TODO next period. There's no
 * background job, so we lazily roll a task back to TODO the next time it's
 * fetched if its last completion falls outside the current period. */
export async function getTasksWithRollover() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const tasks = await prisma.gymTask.findMany({
    include: { assignedTo: true, createdBy: true },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
  });

  const staleIds: string[] = [];
  for (const t of tasks) {
    if (t.status !== "COMPLETED" || !t.completedAt) continue;
    if (t.recurrence === "DAILY" && t.completedAt < todayStart) staleIds.push(t.id);
    if (t.recurrence === "WEEKLY" && t.completedAt < weekStart) staleIds.push(t.id);
  }

  if (staleIds.length > 0) {
    await prisma.gymTask.updateMany({ where: { id: { in: staleIds } }, data: { status: "TODO", completedAt: null } });
    for (const t of tasks) {
      if (staleIds.includes(t.id)) {
        t.status = "TODO";
        t.completedAt = null;
      }
    }
  }

  // Flag overdue one-off tasks (past due date, still open) for display purposes.
  return tasks.map((t) => {
    const isOverdue = t.status !== "COMPLETED" && t.dueDate !== null && t.dueDate < todayStart && t.recurrence === "ONE_OFF";
    return { ...t, displayStatus: isOverdue ? "OVERDUE" : t.status };
  });
}

export function isTaskDueOnWeekday(recurrenceDay: string | null, date: Date) {
  if (!recurrenceDay) return false;
  return WEEKDAY_INDEX[recurrenceDay] === date.getDay();
}
