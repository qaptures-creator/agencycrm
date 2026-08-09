"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, AtSign, Clock, AlertCircle } from "lucide-react";
import { PersonAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatRelativeToNow, isOverdue } from "@/lib/utils";
import type { Lead, User, Service } from "@prisma/client";

export type LeadCardData = Lead & { assignedTo: User | null; services: Service[] };

export function LeadCard({
  lead,
  onClick,
}: {
  lead: LeadCardData;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: "lead", lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const overdue = isOverdue(lead.nextFollowUpAt);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
          <p className="truncate text-sm font-semibold">{lead.companyName}</p>
        </div>
        {lead.estimatedValue ? (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {formatCurrency(lead.estimatedValue)}
          </span>
        ) : null}
      </div>

      <p className="truncate text-xs text-muted-foreground">{lead.contactName}</p>

      {lead.instagram && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <AtSign className="size-3" />
          <span className="truncate">{lead.instagram}</span>
        </div>
      )}

      {lead.services.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.services.slice(0, 2).map((s) => (
            <Badge key={s.id} variant="secondary" className="text-[10px]">
              {s.name}
            </Badge>
          ))}
          {lead.services.length > 2 && (
            <Badge variant="secondary" className="text-[10px]">
              +{lead.services.length - 2}
            </Badge>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        {lead.nextFollowUpAt ? (
          <div
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium",
              overdue ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {overdue ? <AlertCircle className="size-3" /> : <Clock className="size-3" />}
            {formatRelativeToNow(lead.nextFollowUpAt)}
          </div>
        ) : (
          <span />
        )}
        {lead.assignedTo && <PersonAvatar name={lead.assignedTo.name} color={lead.assignedTo.color} className="size-6" />}
      </div>
    </div>
  );
}
