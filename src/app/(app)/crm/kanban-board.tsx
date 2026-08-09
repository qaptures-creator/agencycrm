"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { LeadCard, type LeadCardData } from "./lead-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, cn } from "@/lib/utils";
import { reorderLeadsInStage } from "@/actions/leads";
import { reorderStages, updateStage, createStage } from "@/actions/stages";
import { toast } from "sonner";
import type { PipelineStage } from "@prisma/client";
import { DeleteStageDialog } from "./delete-stage-dialog";

type StageWithLeads = PipelineStage & { leads: LeadCardData[] };

export function KanbanBoard({
  initialStages,
  onOpenLead,
  onAddLead,
}: {
  initialStages: StageWithLeads[];
  onOpenLead: (leadId: string) => void;
  onAddLead: (stageId: string) => void;
}) {
  const [stages, setStages] = React.useState(initialStages);
  const [activeLead, setActiveLead] = React.useState<LeadCardData | null>(null);
  const [activeStage, setActiveStage] = React.useState<StageWithLeads | null>(null);

  React.useEffect(() => setStages(initialStages), [initialStages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function findStageOfLead(leadId: string) {
    return stages.find((s) => s.leads.some((l) => l.id === leadId));
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "lead") setActiveLead(data.lead);
    if (data?.type === "stage") setActiveStage(data.stage);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    if (activeData?.type !== "lead") return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const overData = over.data.current;
    const sourceStage = findStageOfLead(activeId);
    const destStageId = overData?.type === "lead" ? findStageOfLead(overId)?.id : (overId as string);
    if (!sourceStage || !destStageId) return;

    if (sourceStage.id === destStageId && overData?.type !== "lead") return;

    setStages((prev) => {
      const src = prev.find((s) => s.id === sourceStage.id)!;
      const dest = prev.find((s) => s.id === destStageId)!;
      if (!src || !dest) return prev;

      const activeIndex = src.leads.findIndex((l) => l.id === activeId);
      if (activeIndex === -1) return prev;
      const [moved] = src.leads.splice(activeIndex, 1);

      if (src.id === dest.id) {
        const overIndex = dest.leads.findIndex((l) => l.id === overId);
        dest.leads.splice(overIndex >= 0 ? overIndex : dest.leads.length, 0, moved);
      } else {
        const overIndex = dest.leads.findIndex((l) => l.id === overId);
        dest.leads.splice(overIndex >= 0 ? overIndex : dest.leads.length, 0, moved);
      }

      return prev.map((s) => {
        if (s.id === src.id) return { ...src, leads: [...src.leads] };
        if (s.id === dest.id) return { ...dest, leads: [...dest.leads] };
        return s;
      });
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);
    setActiveStage(null);
    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.type === "stage") {
      const oldIndex = stages.findIndex((s) => s.id === active.id);
      const newIndex = stages.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(stages, oldIndex, newIndex);
      setStages(reordered);
      try {
        await reorderStages(reordered.map((s) => s.id));
      } catch {
        toast.error("Couldn't save stage order");
        setStages(initialStages);
      }
      return;
    }

    if (activeData?.type === "lead") {
      const destStage = findStageOfLead(active.id as string);
      if (!destStage) return;
      try {
        await reorderLeadsInStage(destStage.id, destStage.leads.map((l) => l.id));
      } catch {
        toast.error("Couldn't save lead position");
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4 scrollbar-thin">
        <SortableContext items={stages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          {stages.map((stage) => (
            <StageColumn key={stage.id} stage={stage} onOpenLead={onOpenLead} onAddLead={onAddLead} />
          ))}
        </SortableContext>
        <AddStageButton />
      </div>

      <DragOverlay>
        {activeLead && (
          <div className="w-72 rotate-2">
            <LeadCard lead={activeLead} onClick={() => {}} />
          </div>
        )}
        {activeStage && (
          <div className="w-72 rounded-xl border border-border bg-secondary/60 p-3 shadow-lg">
            <p className="text-sm font-semibold">{activeStage.name}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage,
  onOpenLead,
  onAddLead,
}: {
  stage: StageWithLeads;
  onOpenLead: (id: string) => void;
  onAddLead: (stageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    data: { type: "stage", stage },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(stage.name);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const totalValue = stage.leads.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);

  async function saveRename() {
    setRenaming(false);
    if (name.trim() && name.trim() !== stage.name) {
      try {
        await updateStage(stage.id, { name: name.trim() });
      } catch {
        toast.error("Couldn't rename stage");
      }
    } else {
      setName(stage.name);
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="flex w-72 shrink-0 flex-col rounded-xl bg-secondary/30">
      <div className="flex items-center gap-1.5 px-2 pt-2.5 pb-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
        {renaming ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") {
                  setName(stage.name);
                  setRenaming(false);
                }
              }}
              className="h-6 px-1.5 text-sm"
            />
            <button onClick={saveRename} className="text-success">
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => {
                setName(stage.name);
                setRenaming(false);
              }}
              className="text-muted-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button className="flex-1 truncate text-left text-sm font-semibold" onDoubleClick={() => setRenaming(true)}>
            {stage.name}
          </button>
        )}
        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {stage.leads.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground hover:bg-secondary">
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenaming(true)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Delete stage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {totalValue > 0 && (
        <div className="px-3 pb-2 text-xs text-muted-foreground">{formatCurrency(totalValue)} total</div>
      )}

      <SortableContext items={stage.leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div
          id={stage.id}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin px-2 pb-2",
            stage.leads.length === 0 && "min-h-32"
          )}
        >
          {stage.leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onOpenLead(lead.id)} />
          ))}
          {stage.leads.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
              Drop leads here
            </div>
          )}
        </div>
      </SortableContext>

      <div className="p-2 pt-0">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => onAddLead(stage.id)}>
          <Plus /> Add lead
        </Button>
      </div>

      <DeleteStageDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        stage={stage}
        leadCount={stage.leads.length}
      />
    </div>
  );
}

function AddStageButton() {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");

  async function submit() {
    if (!name.trim()) {
      setAdding(false);
      return;
    }
    try {
      await createStage(name.trim());
      setName("");
      setAdding(false);
    } catch {
      toast.error("Couldn't create stage");
    }
  }

  if (adding) {
    return (
      <div className="flex w-72 shrink-0 items-center gap-1.5 rounded-xl bg-secondary/30 p-2.5">
        <Input
          autoFocus
          placeholder="Stage name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setAdding(false);
          }}
          className="h-8"
        />
        <Button size="sm" onClick={submit}>
          Add
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="flex w-72 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
    >
      <Plus className="size-4" /> Add stage
    </button>
  );
}

export type { StageWithLeads };
