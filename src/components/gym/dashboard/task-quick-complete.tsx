"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleTaskCompleteAction } from "@/actions/gym/tasks";

export function TaskQuickComplete({ taskId, completed }: { taskId: string; completed: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => toggleTaskCompleteAction(taskId))}
      disabled={pending}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        completed ? "border-success bg-success/20 text-success" : "border-border text-transparent hover:border-primary"
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </button>
  );
}
