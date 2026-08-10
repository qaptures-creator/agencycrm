"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, IdCard, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlanForm } from "./plan-form";
import { setPlanActiveAction } from "@/actions/gym/memberships";
import { BILLING_FREQUENCIES, labelFor } from "@/lib/gym/constants";

function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);
}

export type PlanRow = {
  id: string;
  name: string;
  price: number;
  billingFrequency: string;
  joiningFee: number | null;
  contractLengthMonths: number | null;
  description: string | null;
  active: boolean;
  activeMemberCount: number;
};

export function PlanList({ plans, canManage }: { plans: PlanRow[]; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlanRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(plan: PlanRow) {
    setEditing(plan);
    setDialogOpen(true);
  }

  function toggleActive(plan: PlanRow) {
    startTransition(async () => {
      try {
        await setPlanActiveAction(plan.id, !plan.active);
        toast.success(plan.active ? "Plan deactivated" : "Plan activated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {plans.length} plan{plans.length === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" />
            New Plan
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <EmptyState icon={IdCard} title="No membership plans yet" description="Create your first plan to start assigning memberships." />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Joining Fee</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Active Members</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{moneyGBP(p.price)}</TableCell>
                  <TableCell className="text-muted-foreground">{labelFor(BILLING_FREQUENCIES, p.billingFrequency)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.joiningFee ? moneyGBP(p.joiningFee) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.contractLengthMonths ? `${p.contractLengthMonths} mo` : "Rolling"}
                  </TableCell>
                  <TableCell>{p.activeMemberCount}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <button onClick={() => toggleActive(p)} disabled={pending}>
                        <Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
                      </button>
                    ) : (
                      <Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(p)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit Plan" : "New Plan"}>
        <PlanForm
          plan={editing ?? undefined}
          onSuccess={() => setDialogOpen(false)}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
