"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Clock, AlertCircle } from "lucide-react";
import { PersonAvatar } from "@/components/ui/avatar";
import { cn, formatRelativeToNow, isOverdue } from "@/lib/utils";
import { LEAD_STAGES, LEAD_SOURCES, labelFor } from "@/lib/gym/constants";
import { moveLeadStageAction } from "@/actions/gym/leads";

export type LeadCardData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  membershipInterest: string | null;
  source: string;
  stage: string;
  nextFollowUpAt: string | null;
  assignedTo: { fullName: string } | null;
};

export function LeadKanban({ leads: initialLeads, onOpenLead }: { leads: LeadCardData[]; onOpenLead: (id: string) => void }) {
  const [leads, setLeads] = React.useState(initialLeads);
  const [activeLead, setActiveLead] = React.useState<LeadCardData | null>(null);
  React.useEffect(() => setLeads(initialLeads), [initialLeads]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const newStage = over.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
    try {
      await moveLeadStageAction(leadId, newStage);
    } catch {
      toast.error("Couldn't move lead");
      setLeads(initialLeads);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {LEAD_STAGES.map((stage) => (
          <StageColumn
            key={stage.value}
            stageValue={stage.value}
            stageLabel={stage.label}
            color={stage.color!}
            leads={leads.filter((l) => l.stage === stage.value)}
            onOpenLead={onOpenLead}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && (
          <div className="w-64 rotate-2">
            <LeadCard lead={activeLead} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stageValue,
  stageLabel,
  color,
  leads,
  onOpenLead,
}: {
  stageValue: string;
  stageLabel: string;
  color: string;
  leads: LeadCardData[];
  onOpenLead: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageValue });

  return (
    <div
      ref={setNodeRef}
      className={cn("flex w-64 shrink-0 flex-col rounded-xl bg-secondary/30 transition-colors", isOver && "bg-primary/10 ring-1 ring-primary/40")}
    >
      <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="flex-1 truncate text-sm font-semibold">{stageLabel}</span>
        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin px-2 pb-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onOpenLead(lead.id)} />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, onClick }: { lead: LeadCardData; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const overdue = isOverdue(lead.nextFollowUpAt);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <p className="truncate text-sm font-semibold">{lead.name}</p>
      {lead.membershipInterest && <p className="truncate text-xs text-muted-foreground">{lead.membershipInterest}</p>}
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{labelFor(LEAD_SOURCES, lead.source)}</p>
      <div className="mt-2 flex items-center justify-between">
        {lead.nextFollowUpAt ? (
          <div className={cn("flex items-center gap-1 text-[11px] font-medium", overdue ? "text-destructive" : "text-muted-foreground")}>
            {overdue ? <AlertCircle className="size-3" /> : <Clock className="size-3" />}
            {formatRelativeToNow(lead.nextFollowUpAt)}
          </div>
        ) : (
          <span />
        )}
        {lead.assignedTo && <PersonAvatar name={lead.assignedTo.fullName} className="size-6" />}
      </div>
    </div>
  );
}
