"use client";

import * as React from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Camera, Clapperboard, PackageCheck, CalendarDays, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { Client, Project, Deliverable, DeliverableStatusOption } from "@prisma/client";
import type { GraphEvent } from "@/lib/microsoft-graph";

type ProjectWithClient = Project & { client: Client };
type DeliverableWithClient = Deliverable & { client: Client; status: DeliverableStatusOption };

type CalEvent = {
  date: Date;
  kind: "shoot" | "project-deadline" | "deliverable-deadline" | "outlook-event";
  title: string;
  subtitle: string;
  href: string;
};

export function CalendarView({
  projects,
  deliverables,
  microsoftConnected,
}: {
  projects: ProjectWithClient[];
  deliverables: DeliverableWithClient[];
  microsoftConnected: boolean;
}) {
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [view, setView] = React.useState<"month" | "list">("month");
  const [outlookEvents, setOutlookEvents] = React.useState<GraphEvent[]>([]);
  const [outlookError, setOutlookError] = React.useState(false);

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  React.useEffect(() => {
    if (!microsoftConnected) {
      setOutlookEvents([]);
      return;
    }
    let cancelled = false;
    setOutlookError(false);
    fetch(`/api/microsoft/calendar?start=${gridStart.toISOString()}&end=${gridEnd.toISOString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load Outlook calendar");
        return res.json();
      })
      .then((data: { events: GraphEvent[] }) => {
        if (!cancelled) setOutlookEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setOutlookEvents([]);
          setOutlookError(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microsoftConnected, gridStart.getTime(), gridEnd.getTime()]);

  const events: CalEvent[] = React.useMemo(() => {
    const evts: CalEvent[] = [];
    for (const p of projects) {
      if (p.shootDate) {
        evts.push({
          date: new Date(p.shootDate),
          kind: "shoot",
          title: p.name,
          subtitle: p.client.companyName,
          href: `/projects?project=${p.id}`,
        });
      }
      if (p.deadline) {
        evts.push({
          date: new Date(p.deadline),
          kind: "project-deadline",
          title: p.name,
          subtitle: `${p.client.companyName} · Deadline`,
          href: `/projects?project=${p.id}`,
        });
      }
    }
    for (const d of deliverables) {
      if (d.deadline) {
        evts.push({
          date: new Date(d.deadline),
          kind: "deliverable-deadline",
          title: d.customTypeName || d.contentType,
          subtitle: `${d.client.companyName} · Deliverable`,
          href: `/deliverables?deliverable=${d.id}`,
        });
      }
    }
    for (const e of outlookEvents) {
      evts.push({
        date: new Date(e.start.dateTime + (e.start.dateTime.endsWith("Z") ? "" : "Z")),
        kind: "outlook-event",
        title: e.subject || "(No subject)",
        subtitle: e.location?.displayName ? `${e.location.displayName} · Outlook` : "Outlook",
        href: e.webLink,
      });
    }
    return evts.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [projects, deliverables, outlookEvents]);

  const upcoming = events.filter((e) => e.date.getTime() >= new Date().setHours(0, 0, 0, 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Shoots and deadlines across every client.</p>
        </div>
        <div className="flex items-center gap-2">
          {!microsoftConnected && (
            <Link href="/settings" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              Connect Outlook in Settings to sync your calendar
            </Link>
          )}
          {microsoftConnected && outlookError && (
            <span className="text-xs text-destructive">Couldn't load Outlook events</span>
          )}
          <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
            Month
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            List
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing scheduled yet" description="Shoots and deliverable deadlines will show up here once you add projects." />
      ) : view === "list" ? (
        <div className="space-y-2">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming shoots or deadlines.</p>}
          {upcoming.map((e, i) => (
            <Link
              key={i}
              href={e.href}
              {...(e.kind === "outlook-event" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/40"
            >
              <EventIcon kind={e.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="truncate text-xs text-muted-foreground">{e.subtitle}</p>
              </div>
              <span className={cn("shrink-0 text-xs font-medium", isOverdue(e.date) && "text-destructive")}>
                {formatDate(e.date)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-secondary/50 px-2 py-1.5 text-center font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayEvents = events.filter((e) => isSameDay(e.date, day));
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-24 bg-card p-1.5",
                    !isSameMonth(day, month) && "bg-secondary/20 text-muted-foreground/50"
                  )}
                >
                  <p className={cn("mb-1 text-right text-[11px]", isToday(day) && "font-bold text-primary")}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <Link
                        key={i}
                        href={e.href}
                        {...(e.kind === "outlook-event" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={cn(
                          "block truncate rounded px-1 py-0.5 text-[10px] font-medium",
                          e.kind === "shoot" && "bg-primary/15 text-primary",
                          e.kind === "project-deadline" && "bg-warning/20 text-warning-foreground",
                          e.kind === "deliverable-deadline" && "bg-accent text-accent-foreground",
                          e.kind === "outlook-event" && "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                        )}
                        title={e.title}
                      >
                        {e.title}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Shoot</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" /> Project deadline</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent-foreground" /> Deliverable deadline</span>
            {microsoftConnected && (
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-500" /> Outlook</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EventIcon({ kind }: { kind: CalEvent["kind"] }) {
  const cls = "flex size-8 shrink-0 items-center justify-center rounded-full";
  if (kind === "shoot")
    return (
      <div className={cn(cls, "bg-primary/15 text-primary")}>
        <Camera className="size-4" />
      </div>
    );
  if (kind === "project-deadline")
    return (
      <div className={cn(cls, "bg-warning/20 text-warning-foreground")}>
        <Clapperboard className="size-4" />
      </div>
    );
  if (kind === "outlook-event")
    return (
      <div className={cn(cls, "bg-sky-500/15 text-sky-600 dark:text-sky-400")}>
        <Mail className="size-4" />
      </div>
    );
  return (
    <div className={cn(cls, "bg-accent text-accent-foreground")}>
      <PackageCheck className="size-4" />
    </div>
  );
}
