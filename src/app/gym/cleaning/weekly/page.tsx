import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function summarizeCell(statuses: string[]) {
  if (statuses.length === 0) return { label: "—", className: "text-muted-foreground" };
  if (statuses.every((s) => s === "COMPLETE")) return { label: `Complete (${statuses.length})`, className: "border-success/40 bg-success/10 text-success" };
  if (statuses.some((s) => s === "MISSED")) return { label: `Missed (${statuses.filter((s) => s === "MISSED").length})`, className: "border-destructive/40 bg-destructive/10 text-destructive" };
  if (statuses.some((s) => s === "AWAITING_REVIEW")) return { label: `Awaiting Review (${statuses.filter((s) => s === "AWAITING_REVIEW").length})`, className: "border-warning/40 bg-warning/15 text-warning-foreground" };
  if (statuses.some((s) => s === "IN_PROGRESS")) return { label: `In Progress (${statuses.filter((s) => s === "IN_PROGRESS").length})`, className: "border-primary/40 bg-primary/10 text-primary" };
  return { label: `Pending (${statuses.length})`, className: "border-border bg-secondary/60 text-muted-foreground" };
}

export default async function CleaningWeeklyPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  await requireGymUser();
  const { week } = await searchParams;

  const anchor = week ? new Date(week + "T00:00:00") : new Date();
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));

  const [zones, tasks] = await Promise.all([
    prisma.gymCleaningZone.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.gymCleaningTask.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      select: { zoneId: true, status: true, date: true },
    }),
  ]);

  const cellMap = new Map<string, string[]>();
  for (const t of tasks) {
    const key = `${t.zoneId}__${t.date.toISOString().slice(0, 10)}`;
    const arr = cellMap.get(key) ?? [];
    arr.push(t.status);
    cellMap.set(key, arr);
  }

  function prevWeekHref() {
    return `/gym/cleaning/weekly?week=${format(addDays(weekStart, -7), "yyyy-MM-dd")}`;
  }
  function nextWeekHref() {
    return `/gym/cleaning/weekly?week=${format(addDays(weekStart, 7), "yyyy-MM-dd")}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Equipment Cleaning — Weekly View</h1>
          <p className="text-sm text-muted-foreground">
            Week of {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" asChild>
            <Link href={prevWeekHref()}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/gym/cleaning/weekly">This Week</Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link href={nextWeekHref()}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button size="sm" className="ml-2 gap-1.5" asChild>
            <Link href="/gym/cleaning">
              <CalendarClock className="size-4" />
              Daily View
            </Link>
          </Button>
        </div>
      </div>

      {zones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cleaning zones set up yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <div className="grid min-w-[900px] grid-cols-[160px_repeat(7,1fr)]">
            <div className="border-b border-r border-border p-2 text-xs font-medium text-muted-foreground">Zone</div>
            {days.map((d, i) => (
              <div key={d} className="border-b border-r border-border p-2 text-center text-xs font-medium text-muted-foreground last:border-r-0">
                {DAY_LABELS[i]}
                <div className="text-[11px] font-normal">{format(new Date(d + "T00:00:00"), "d MMM")}</div>
              </div>
            ))}

            {zones.map((zone) => (
              <div key={zone.id} className="contents">
                <div className="flex items-center border-b border-r border-border p-2 text-sm font-medium">{zone.name}</div>
                {days.map((day) => {
                  const statuses = cellMap.get(`${zone.id}__${day}`) ?? [];
                  const { label, className } = summarizeCell(statuses);
                  return (
                    <Link
                      key={day}
                      href={`/gym/cleaning?date=${day}`}
                      className="flex min-h-14 items-center justify-center border-b border-r border-border p-1.5 last:border-r-0 hover:bg-secondary/40"
                    >
                      <span className={cn("rounded-md border px-2 py-1 text-center text-[11px] font-medium leading-tight", className)}>{label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
