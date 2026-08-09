import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "destructive" | "success" | "warning";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1.5 truncate text-2xl font-semibold tracking-tight",
              tone === "destructive" && "text-destructive",
              tone === "success" && "text-success",
              tone === "warning" && "text-warning-foreground"
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tone === "destructive" && "bg-destructive/10 text-destructive",
            tone === "success" && "bg-success/10 text-success",
            tone === "warning" && "bg-warning/15 text-warning-foreground",
            tone === "default" && "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
}
