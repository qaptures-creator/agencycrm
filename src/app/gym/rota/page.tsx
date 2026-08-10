import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";
import { RotaBoard } from "./rota-board";
import { ClockInOutCard } from "@/components/gym/clock-in-out-card";
import { getOwnAttendanceStatus } from "@/actions/gym/attendance";

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ week?: string; new?: string }> }) {
  const user = await requireGymUser();
  const canManage = can(user.accessRole as GymAccessRole, "manageRota");
  const { week } = await searchParams;

  const anchor = week ? new Date(week + "T00:00:00") : new Date();
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });

  const [staff, shifts, attendanceStatus] = await Promise.all([
    prisma.gymStaff.findMany({ where: { employmentStatus: { not: "Former" } }, orderBy: { fullName: "asc" } }),
    prisma.gymRotaShift.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      include: { staff: true, attendance: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { startTime: "asc" },
    }),
    getOwnAttendanceStatus(),
  ]);

  const serializedShifts = shifts.map((s) => ({
    id: s.id,
    staffId: s.staffId,
    staffName: s.staff.fullName,
    staffPosition: s.staff.position,
    date: s.date.toISOString(),
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    breakMinutes: s.breakMinutes,
    shiftRole: s.shiftRole,
    notes: s.notes,
    published: s.published,
    clockedIn: !!(s.attendance[0]?.clockInAt && !s.attendance[0]?.clockOutAt),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Staff Rota</h1>
          <p className="text-sm text-muted-foreground">
            Week of {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
          </p>
        </div>
      </div>

      {attendanceStatus && (
        <ClockInOutCard
          clockedIn={attendanceStatus.clockedIn}
          clockInAt={attendanceStatus.clockInAt?.toISOString() ?? null}
          shiftLabel={
            attendanceStatus.todaysShift
              ? `Today's shift: ${format(attendanceStatus.todaysShift.startTime, "HH:mm")}–${format(attendanceStatus.todaysShift.endTime, "HH:mm")}`
              : null
          }
        />
      )}

      <RotaBoard
        staff={staff.map((s) => ({ id: s.id, fullName: s.fullName, position: s.position }))}
        shifts={serializedShifts}
        weekStartIso={format(weekStart, "yyyy-MM-dd")}
        days={Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"))}
        canManage={canManage}
      />
    </div>
  );
}
