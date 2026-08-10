"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { Badge } from "@/components/ui/badge";
import { INCIDENT_CATEGORIES } from "@/lib/gym/constants";
import { formatDateTime } from "@/lib/utils";
import { IncidentForm } from "./incident-form";
import { FollowUpDialog } from "./follow-up-dialog";

export type IncidentRow = {
  id: string;
  occurredAt: Date;
  category: string;
  location: string | null;
  description: string;
  actionTaken: string | null;
  witnesses: string | null;
  followUpRequired: boolean;
  followUpNotes: string | null;
  reportedBy: { id: string; name: string } | null;
};

export function IncidentList({ incidents }: { incidents: IncidentRow[] }) {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = React.useState(searchParams.get("new") === "1");
  const [detail, setDetail] = React.useState<IncidentRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {incidents.length} incident{incidents.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Report Incident
        </Button>
      </div>

      {incidents.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No incidents logged" description="Health, safety and security incidents will appear here." />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead>Follow-Up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id} className="cursor-pointer" onClick={() => setDetail(incident)}>
                  <TableCell className="text-muted-foreground">{formatDateTime(incident.occurredAt)}</TableCell>
                  <TableCell>
                    <GymStatusBadge list={INCIDENT_CATEGORIES} value={incident.category} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{incident.location || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{incident.description}</TableCell>
                  <TableCell className="text-muted-foreground">{incident.reportedBy?.name ?? "—"}</TableCell>
                  <TableCell>
                    {incident.followUpRequired ? (
                      <Badge variant="warning">Follow-up needed</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={createOpen} onOpenChange={setCreateOpen} title="Report Incident">
        <IncidentForm onSuccess={() => setCreateOpen(false)} onCancel={() => setCreateOpen(false)} />
      </EntityDialog>

      {detail && <FollowUpDialog incident={detail} open={!!detail} onOpenChange={(open) => !open && setDetail(null)} />}
    </div>
  );
}
