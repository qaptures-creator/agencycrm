"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, KanbanSquare, ListIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KanbanBoard, type StageWithLeads } from "./kanban-board";
import { LeadsTable } from "./leads-table";
import { LeadDrawer } from "./lead-drawer";
import { formatCurrency, isOverdue } from "@/lib/utils";
import type { ServiceOption } from "@/components/services-select";
import type { User } from "@prisma/client";

export function CrmView({
  stages,
  users,
  services,
  currentUserId,
}: {
  stages: StageWithLeads[];
  users: User[];
  services: ServiceOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeLeadId, setActiveLeadId] = React.useState<string | null>(null);
  const [createStageId, setCreateStageId] = React.useState<string | undefined>();

  React.useEffect(() => {
    const leadId = searchParams.get("lead");
    if (leadId) {
      setActiveLeadId(leadId);
      setDrawerOpen(true);
    }
  }, [searchParams]);

  function openLead(id: string) {
    setActiveLeadId(id);
    setCreateStageId(undefined);
    setDrawerOpen(true);
  }

  function addLead(stageId?: string) {
    setActiveLeadId(null);
    setCreateStageId(stageId ?? stages[0]?.id);
    setDrawerOpen(true);
  }

  function handleDrawerChange(open: boolean) {
    setDrawerOpen(open);
    if (!open) {
      setActiveLeadId(null);
      if (searchParams.get("lead")) router.replace("/crm");
    }
  }

  const totalLeads = stages.reduce((sum, s) => sum + s.leads.length, 0);
  const activeStages = stages.filter((s) => !s.isWon && !s.isLost);
  const pipelineValue = stages
    .filter((s) => !s.isWon && !s.isLost)
    .reduce((sum, s) => sum + s.leads.reduce((a, l) => a + (l.estimatedValue ?? 0), 0), 0);

  const overdueLeads = stages
    .flatMap((s) => s.leads)
    .filter((l) => isOverdue(l.nextFollowUpAt));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CRM Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {totalLeads} lead{totalLeads === 1 ? "" : "s"} · {activeStages.length} active stage{activeStages.length === 1 ? "" : "s"} ·{" "}
            {formatCurrency(pipelineValue)} pipeline value
          </p>
        </div>
        <Button onClick={() => addLead()}>
          <Plus /> Add lead
        </Button>
      </div>

      {overdueLeads.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="text-destructive-foreground">
            <strong>{overdueLeads.length}</strong> follow-up{overdueLeads.length === 1 ? "" : "s"} overdue:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {overdueLeads.slice(0, 5).map((l) => (
              <button
                key={l.id}
                onClick={() => openLead(l.id)}
                className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-foreground shadow-sm hover:bg-secondary"
              >
                {l.companyName}
              </button>
            ))}
            {overdueLeads.length > 5 && <span className="text-xs text-muted-foreground">+{overdueLeads.length - 5} more</span>}
          </div>
        </div>
      )}

      <Tabs defaultValue="kanban" className="flex flex-1 flex-col overflow-hidden">
        <TabsList>
          <TabsTrigger value="kanban">
            <KanbanSquare /> Kanban
          </TabsTrigger>
          <TabsTrigger value="list">
            <ListIcon /> List
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="flex-1 overflow-hidden">
          <KanbanBoard initialStages={stages} onOpenLead={openLead} onAddLead={addLead} />
        </TabsContent>
        <TabsContent value="list">
          <LeadsTable stages={stages} users={users} onOpenLead={openLead} />
        </TabsContent>
      </Tabs>

      <LeadDrawer
        leadId={activeLeadId}
        createStageId={createStageId}
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
        stages={stages}
        users={users}
        services={services}
        currentUserId={currentUserId}
      />
    </div>
  );
}
