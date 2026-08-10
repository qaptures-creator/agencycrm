"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Dumbbell, TriangleAlert, ImageOff, Image as ImageIcon, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS, labelFor } from "@/lib/gym/constants";
import { cn, formatDate } from "@/lib/utils";
import { EquipmentForm, type EquipmentRow } from "./equipment-form";
import { ReportIssueDialog } from "./report-issue-dialog";

function serviceDueState(date: Date | null): "overdue" | "soon" | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "soon";
  return null;
}

export function EquipmentList({ equipment }: { equipment: EquipmentRow[] }) {
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = React.useState(searchParams.get("new") === "1");
  const [editing, setEditing] = React.useState<EquipmentRow | null>(null);
  const [reportTarget, setReportTarget] = React.useState<EquipmentRow | null>(null);

  const highlightedId = searchParams.get("equipment");

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(item: EquipmentRow) {
    setEditing(item);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {equipment.length} item{equipment.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          Add Equipment
        </Button>
      </div>

      {equipment.length === 0 ? (
        <EmptyState icon={Dumbbell} title="No equipment registered" description="Add your first machine to start tracking condition and service dates." />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Next Service</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.map((item) => {
                const dueState = serviceDueState(item.nextServiceDate);
                return (
                  <TableRow
                    key={item.id}
                    className={cn("cursor-pointer", highlightedId === item.id && "bg-primary/5")}
                    onClick={() => openEdit(item)}
                  >
                    <TableCell>
                      {item.photoUrl ? (
                        <ImageIcon className="size-4 text-primary" />
                      ) : (
                        <ImageOff className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      {(item.manufacturer || item.model) && (
                        <div className="text-xs text-muted-foreground">
                          {[item.manufacturer, item.model].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{labelFor(EQUIPMENT_CATEGORIES, item.category)}</TableCell>
                    <TableCell>
                      <GymStatusBadge list={EQUIPMENT_CONDITIONS} value={item.condition} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.location || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {dueState && <TriangleAlert className={cn("size-3.5", dueState === "overdue" ? "text-destructive" : "text-warning-foreground")} />}
                        <span className={cn(dueState === "overdue" && "text-destructive", dueState === "soon" && "text-warning-foreground")}>
                          {formatDate(item.nextServiceDate)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportTarget(item);
                        }}
                      >
                        <Wrench className="size-3.5" />
                        Report Issue
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? "Edit Equipment" : "Add Equipment"}>
        <EquipmentForm equipment={editing ?? undefined} onSuccess={() => setDialogOpen(false)} onCancel={() => setDialogOpen(false)} />
      </EntityDialog>

      {reportTarget && (
        <ReportIssueDialog
          equipmentId={reportTarget.id}
          equipmentName={reportTarget.name}
          open={!!reportTarget}
          onOpenChange={(open) => !open && setReportTarget(null)}
        />
      )}
    </div>
  );
}
