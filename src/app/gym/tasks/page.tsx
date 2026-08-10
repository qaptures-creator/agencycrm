import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { getTasksWithRollover } from "@/lib/gym/tasks-data";
import { TaskBoard } from "./task-board";

export default async function TasksPage() {
  await requireGymUser();

  const [tasks, staff] = await Promise.all([
    getTasksWithRollover(),
    prisma.gymStaff.findMany({ where: { employmentStatus: { not: "Former" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Day-to-day operational to-dos, one-off and recurring.</p>
      </div>
      <TaskBoard tasks={tasks} staff={staff} />
    </div>
  );
}
