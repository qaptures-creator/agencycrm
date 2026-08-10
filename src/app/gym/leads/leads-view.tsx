"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KanbanSquare, Table2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { LeadKanban, type LeadCardData } from "./lead-kanban";
import { LeadForm } from "./lead-form";
import { LeadDetailSheet, type LeadDetail } from "./lead-detail-sheet";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { LEAD_STAGES, LEAD_SOURCES, labelFor } from "@/lib/gym/constants";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate, cn } from "@/lib/utils";

type LeadRow = LeadCardData & { nextFollowUpAtRaw: string | null; createdAt: string };

export function LeadsView({
  leads,
  staff,
  stats,
  selected,
}: {
  leads: LeadRow[];
  staff: { id: string; fullName: string }[];
  stats: { total: number; joined: number; conversionRate: number };
  selected: LeadDetail | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = React.useState<"kanban" | "table">("kanban");
  const [dialogOpen, setDialogOpen] = React.useState(searchParams.get("new") === "1");

  function openLead(id: string) {
    router.push(`/gym/leads?lead=${id}`);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Leads</p>
            <p className="mt-1 text-xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Joined</p>
            <p className="mt-1 text-xl font-semibold text-success">{stats.joined}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lead → Member Conversion</p>
            <p className="mt-1 text-xl font-semibold text-primary">{stats.conversionRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <button
            onClick={() => setView("kanban")}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", view === "kanban" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          >
            <KanbanSquare className="size-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setView("table")}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", view === "table" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          >
            <Table2 className="size-3.5" />
            Table
          </button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          New Lead
        </Button>
      </div>

      {view === "kanban" ? (
        <LeadKanban leads={leads} onOpenLead={openLead} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Next Follow-Up</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => openLead(l.id)}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.email || l.phone || "—"}</TableCell>
                  <TableCell>{labelFor(LEAD_SOURCES, l.source)}</TableCell>
                  <TableCell className="text-muted-foreground">{l.membershipInterest || "—"}</TableCell>
                  <TableCell>{l.assignedTo?.fullName ?? "Unassigned"}</TableCell>
                  <TableCell>{l.nextFollowUpAtRaw ? formatDate(l.nextFollowUpAtRaw) : "—"}</TableCell>
                  <TableCell>
                    <GymStatusBadge list={LEAD_STAGES} value={l.stage} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title="New Lead">
        <LeadForm
          staff={staff}
          onSuccess={() => {
            setDialogOpen(false);
            router.replace("/gym/leads");
          }}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>

      <LeadDetailSheet lead={selected} staff={staff} />
    </div>
  );
}
