"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  AtSign,
  MessageCircle,
  Users,
  FileText,
  Clock,
  StickyNote,
  Check,
  Trash2,
} from "lucide-react";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/constants";
import { activitySchema, type ActivityInput } from "@/lib/validators";
import { createActivity, completeActivity, deleteActivity } from "@/actions/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { cn, formatDateTime, isOverdue } from "@/lib/utils";
import type { Activity, User } from "@prisma/client";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  EMAIL: Mail,
  INSTAGRAM_DM: AtSign,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  PROPOSAL: FileText,
  FOLLOW_UP: Clock,
  NOTE: StickyNote,
};

export type ActivityWithUser = Activity & { createdBy: User | null };

export function ActivityLog({
  activities,
  leadId,
  clientId,
  currentUserId,
  onChanged,
}: {
  activities: ActivityWithUser[];
  leadId?: string;
  clientId?: string;
  currentUserId?: string;
  onChanged?: () => void;
}) {
  type FormValues = z.input<typeof activitySchema>;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues, unknown, ActivityInput>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: "NOTE", subject: "", notes: "", dueAt: "", leadId, clientId, createdById: currentUserId },
  });

  async function onSubmit(values: ActivityInput) {
    try {
      await createActivity({ ...values, leadId, clientId, createdById: currentUserId });
      reset({ type: "NOTE", subject: "", notes: "", dueAt: "", leadId, clientId, createdById: currentUserId });
      toast.success("Activity logged");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log activity");
    }
  }

  const ordered = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Input type="date" className="h-8" placeholder="Next follow-up" {...register("dueAt")} />
        </div>
        <Input placeholder="Subject (optional)" className="h-8" {...register("subject")} />
        <Textarea placeholder="What happened, or what's next…" rows={2} {...register("notes")} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Logging…" : "Log activity"}
          </Button>
        </div>
      </form>

      {ordered.length === 0 ? (
        <EmptyState icon={Clock} title="No activity yet" description="Calls, emails, DMs and notes will show up here." />
      ) : (
        <ol className="space-y-3">
          {ordered.map((a) => {
            const Icon = ICONS[a.type as ActivityType] ?? StickyNote;
            const overdue = a.dueAt && !a.completedAt && isOverdue(a.dueAt);
            return (
              <li key={a.id} className="flex gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                    overdue ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {a.subject || ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}
                      </p>
                      {a.notes && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{a.notes}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(a.createdAt)}</span>
                        {a.createdBy && (
                          <span className="flex items-center gap-1">
                            <PersonAvatar name={a.createdBy.name} color={a.createdBy.color} className="size-4" />
                            {a.createdBy.name}
                          </span>
                        )}
                        {a.dueAt && (
                          <span className={cn(overdue && "font-medium text-destructive")}>
                            {a.completedAt ? "Completed" : overdue ? "Overdue" : "Due"} {formatDateTime(a.dueAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {a.dueAt && !a.completedAt && (
                        <button
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-success"
                          onClick={async () => {
                            await completeActivity(a.id);
                            onChanged?.();
                          }}
                          title="Mark complete"
                        >
                          <Check className="size-3.5" />
                        </button>
                      )}
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          await deleteActivity(a.id);
                          onChanged?.();
                        }}
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
