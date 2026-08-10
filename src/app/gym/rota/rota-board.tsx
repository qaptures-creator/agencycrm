"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Plus, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ShiftDialog, type ShiftDialogState } from "./shift-dialog";
import { duplicateShiftToDateAction, duplicateLastWeekAction, publishWeekAction } from "@/actions/gym/rota";

type Shift = {
  id: string;
  staffId: string;
  staffName: string;
  staffPosition: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  shiftRole: string | null;
  notes: string | null;
  published: boolean;
  clockedIn: boolean;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hoursOf(shift: Shift) {
  const ms = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
  return Math.max(0, ms / 3600000 - shift.breakMinutes / 60);
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function RotaBoard({
  staff,
  shifts,
  weekStartIso,
  days,
  canManage,
}: {
  staff: { id: string; fullName: string; position: string }[];
  shifts: Shift[];
  weekStartIso: string;
  days: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = React.useState(searchParams.get("new") === "1");
  const [dialogState, setDialogState] = React.useState<ShiftDialogState | null>(
    searchParams.get("new") === "1" ? { mode: "create", date: days[0] } : null
  );
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [pending, startTransition] = React.useTransition();

  const positions = Array.from(new Set(staff.map((s) => s.position)));
  const visibleStaff = roleFilter === "all" ? staff : staff.filter((s) => s.position === roleFilter);

  const byStaffDay = React.useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.staffId}__${s.date.slice(0, 10)}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [shifts]);

  const weeklyHours = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shifts) {
      map.set(s.staffId, (map.get(s.staffId) ?? 0) + hoursOf(s));
    }
    return map;
  }, [shifts]);

  function goWeek(offsetDays: number) {
    const d = new Date(weekStartIso + "T00:00:00");
    d.setDate(d.getDate() + offsetDays);
    router.push(`/gym/rota?week=${d.toISOString().slice(0, 10)}`);
  }

  function openCreate(staffId: string, date: string) {
    if (!canManage) return;
    setDialogState({ mode: "create", staffId, date });
    setDialogOpen(true);
  }

  function openEdit(shift: Shift) {
    if (!canManage) return;
    setDialogState({
      mode: "edit",
      shift: {
        id: shift.id,
        staffId: shift.staffId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        shiftRole: shift.shiftRole,
        notes: shift.notes,
      },
    });
    setDialogOpen(true);
  }

  function handleDuplicateNextDay(e: React.MouseEvent, shift: Shift) {
    e.stopPropagation();
    const nextDate = new Date(shift.date);
    nextDate.setDate(nextDate.getDate() + 1);
    startTransition(async () => {
      try {
        await duplicateShiftToDateAction(shift.id, nextDate.toISOString().slice(0, 10));
        toast.success("Shift duplicated to next day");
      } catch {
        toast.error("Failed to duplicate shift");
      }
    });
  }

  function handleDuplicateLastWeek() {
    startTransition(async () => {
      try {
        const count = await duplicateLastWeekAction(weekStartIso);
        toast.success(`Duplicated ${count} shift${count === 1 ? "" : "s"} from last week`);
      } catch {
        toast.error("Failed to duplicate last week's rota");
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        const count = await publishWeekAction(weekStartIso);
        toast.success(count > 0 ? `Published ${count} shift${count === 1 ? "" : "s"}` : "Rota already published");
      } catch {
        toast.error("Failed to publish rota");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => goWeek(-7)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push("/gym/rota")}>
            This Week
          </Button>
          <Button variant="outline" size="icon" onClick={() => goWeek(7)}>
            <ChevronRight className="size-4" />
          </Button>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="ml-2 h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="all">All roles</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDuplicateLastWeek} disabled={pending}>
              <Copy className="size-3.5" />
              Duplicate Last Week
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePublish} disabled={pending}>
              <Send className="size-3.5" />
              Publish Rota
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setDialogState({ mode: "create", date: days[0] });
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Shift
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="grid min-w-[900px] grid-cols-[160px_repeat(7,1fr)_90px]">
          <div className="border-b border-r border-border p-2 text-xs font-medium text-muted-foreground">Staff</div>
          {days.map((d, i) => (
            <div key={d} className="border-b border-r border-border p-2 text-center text-xs font-medium text-muted-foreground last:border-r-0">
              {DAY_LABELS[i]}
              <div className="text-[11px] font-normal">{new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
            </div>
          ))}
          <div className="border-b border-border p-2 text-center text-xs font-medium text-muted-foreground">Hours</div>

          {visibleStaff.map((member) => (
            <React.Fragment key={member.id}>
              <div className="flex flex-col justify-center gap-0.5 border-b border-r border-border p-2">
                <span className="truncate text-sm font-medium">{member.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{member.position}</span>
              </div>
              {days.map((day) => {
                const dayShifts = byStaffDay.get(`${member.id}__${day}`) ?? [];
                const hasConflict = dayShifts.length > 1;
                return (
                  <div
                    key={day}
                    onClick={() => dayShifts.length === 0 && openCreate(member.id, day)}
                    className={cn(
                      "min-h-16 space-y-1 border-b border-r border-border p-1.5 last:border-r-0",
                      canManage && dayShifts.length === 0 && "cursor-pointer hover:bg-secondary/40"
                    )}
                  >
                    {dayShifts.map((shift) => {
                      const hrs = hoursOf(shift);
                      const long = hrs > 10;
                      return (
                        <div
                          key={shift.id}
                          onClick={() => openEdit(shift)}
                          className={cn(
                            "group relative rounded-md border px-2 py-1 text-xs",
                            canManage && "cursor-pointer",
                            hasConflict
                              ? "border-destructive/50 bg-destructive/10"
                              : long
                                ? "border-warning/50 bg-warning/10"
                                : "border-primary/25 bg-primary/10"
                          )}
                        >
                          <div className="flex items-center gap-1 font-medium">
                            {(hasConflict || long) && <TriangleAlert className="size-3 shrink-0 text-warning-foreground" />}
                            {timeLabel(shift.startTime)}–{timeLabel(shift.endTime)}
                          </div>
                          {shift.shiftRole && <div className="truncate text-muted-foreground">{shift.shiftRole}</div>}
                          <div className="flex items-center justify-between">
                            <Badge variant={shift.clockedIn ? "success" : "secondary"} className="mt-0.5 px-1 py-0 text-[9px]">
                              {shift.clockedIn ? "Clocked In" : shift.published ? "Published" : "Draft"}
                            </Badge>
                            {canManage && (
                              <button
                                onClick={(e) => handleDuplicateNextDay(e, shift)}
                                className="opacity-0 group-hover:opacity-100"
                                title="Duplicate to next day"
                              >
                                <Copy className="size-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className="flex items-center justify-center border-b border-border p-2 text-sm font-medium">
                {(weeklyHours.get(member.id) ?? 0).toFixed(1)}h
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {canManage && (
        <ShiftDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          state={dialogState}
          staff={staff}
          onDone={() => {
            setDialogOpen(false);
            router.replace(`/gym/rota?week=${weekStartIso}`);
          }}
        />
      )}
    </div>
  );
}
