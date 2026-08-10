import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { PersonAvatar } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { EMPLOYMENT_STATUSES } from "@/lib/gym/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { AccountPanel } from "./account-panel";
import { StaffEditButton } from "./staff-edit-button";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireGymUser();
  const canManage = can(user.accessRole as GymAccessRole, "manageStaff");

  const staff = await prisma.gymStaff.findUnique({
    where: { id },
    include: {
      user: true,
      shifts: { orderBy: { date: "desc" }, take: 5 },
      tasksAssigned: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!staff) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar name={staff.fullName} className="size-14 text-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold">{staff.fullName}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{staff.position}</span>
              <GymStatusBadge list={EMPLOYMENT_STATUSES} value={staff.employmentStatus} />
            </div>
          </div>
        </div>
        {canManage && <StaffEditButton staff={staff} />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Email" value={staff.email} />
            <DetailRow label="Phone" value={staff.phone} />
            <DetailRow label="Start Date" value={staff.startDate ? formatDate(staff.startDate) : null} />
            <DetailRow label="Typical Hours" value={staff.typicalHours} />
            <DetailRow label="Emergency Contact" value={staff.emergencyContactName} />
            <DetailRow label="Emergency Phone" value={staff.emergencyContactPhone} />
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Login Account</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountPanel staffId={staff.id} account={staff.user} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{staff.notes || "No notes yet."}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Shifts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.shifts.length === 0 && <p className="text-sm text-muted-foreground">No shifts recorded.</p>}
            {staff.shifts.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span>{formatDate(s.date)}</span>
                <span className="text-muted-foreground">
                  {s.startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}–
                  {s.endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Assigned Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.tasksAssigned.length === 0 && <p className="text-sm text-muted-foreground">No tasks assigned.</p>}
            {staff.tasksAssigned.map((t) => (
              <div key={t.id} className="flex justify-between text-sm">
                <span className="truncate">{t.title}</span>
                <span className="text-muted-foreground">{t.dueDate ? formatDateTime(t.dueDate) : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}
