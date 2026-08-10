"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { MemberForm } from "../member-form";
import type { GymMember } from "@prisma/client";

export function MemberEditButton({ member }: { member: GymMember }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Update Details
      </Button>
      <EntityDialog open={open} onOpenChange={setOpen} title="Update Member Details">
        <MemberForm member={member} onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </EntityDialog>
    </>
  );
}
