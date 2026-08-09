"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonAvatar } from "@/components/ui/avatar";
import { DotBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Users2 } from "lucide-react";
import { cn, formatCurrency, formatDate, isOverdue } from "@/lib/utils";
import type { StageWithLeads } from "./kanban-board";
import type { User } from "@prisma/client";

export function LeadsTable({
  stages,
  users,
  onOpenLead,
}: {
  stages: StageWithLeads[];
  users: User[];
  onOpenLead: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState("all");

  const allLeads = stages.flatMap((stage) => stage.leads.map((lead) => ({ ...lead, stage })));

  const filtered = allLeads.filter((lead) => {
    if (stageFilter !== "all" && lead.stage.id !== stageFilter) return false;
    if (assigneeFilter !== "all" && lead.assignedToId !== assigneeFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${lead.companyName} ${lead.contactName} ${lead.email ?? ""} ${lead.industry ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search leads…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Assigned to" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={allLeads.length === 0 ? "No leads yet" : "No leads match your filters"}
          description={allLeads.length === 0 ? "Add your first lead to start building your pipeline." : "Try adjusting your search or filters."}
        />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => onOpenLead(lead.id)}>
                  <TableCell className="font-medium">{lead.companyName}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.contactName}</TableCell>
                  <TableCell>
                    <DotBadge color={lead.stage.color}>{lead.stage.name}</DotBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.source || "—"}</TableCell>
                  <TableCell>{formatCurrency(lead.estimatedValue)}</TableCell>
                  <TableCell>
                    {lead.nextFollowUpAt ? (
                      <span className={cn(isOverdue(lead.nextFollowUpAt) && "font-medium text-destructive")}>
                        {formatDate(lead.nextFollowUpAt)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <PersonAvatar name={lead.assignedTo.name} color={lead.assignedTo.color} className="size-5" />
                        <span className="text-xs">{lead.assignedTo.name}</span>
                      </div>
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
    </div>
  );
}
