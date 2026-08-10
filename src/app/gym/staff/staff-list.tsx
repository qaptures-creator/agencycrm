"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { StaffForm } from "./staff-form";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/avatar";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { EMPLOYMENT_STATUSES } from "@/lib/gym/constants";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

type StaffRow = {
  id: string;
  fullName: string;
  position: string;
  employmentStatus: string;
  email: string | null;
  phone: string | null;
  typicalHours: string | null;
  userId: string | null;
};

export function StaffList({ staff, canManage }: { staff: StaffRow[]; canManage: boolean }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{staff.length} staff member{staff.length === 1 ? "" : "s"}</p>
        {canManage && (
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Add Staff Member
          </Button>
        )}
      </div>

      {staff.length === 0 ? (
        <EmptyState icon={UserCog} title="No staff yet" description="Add your first team member to get started." />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => router.push(`/gym/staff/${s.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <PersonAvatar name={s.fullName} />
                      <span className="font-medium">{s.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{s.position}</TableCell>
                  <TableCell>
                    <GymStatusBadge list={EMPLOYMENT_STATUSES} value={s.employmentStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.email || s.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.typicalHours || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.userId ? "success" : "secondary"}>{s.userId ? "Active" : "None"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={open} onOpenChange={setOpen} title="Add Staff Member">
        <StaffForm onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </EntityDialog>
    </div>
  );
}
