"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { StaffForm } from "../staff-form";
import type { GymStaff } from "@prisma/client";

export function StaffEditButton({ staff }: { staff: GymStaff }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Edit Profile
      </Button>
      <EntityDialog open={open} onOpenChange={setOpen} title="Edit Staff Profile">
        <StaffForm staff={staff} onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </EntityDialog>
    </>
  );
}
