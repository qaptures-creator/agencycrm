import { Download, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  exportHref,
  exportLabel,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "destructive" | "success" | "warning";
  /** When set, renders a small download affordance that links straight to
   * a CSV of the real records behind this number — never just the count.
   * Omit for purely presentational tiles. */
  exportHref?: string;
  exportLabel?: string;
}) {
  return (
    <Card className="relative p-4">
      {exportHref && (
        <a
          href={exportHref}
          download
          title={exportLabel ?? `Export ${label} as CSV`}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Download className="size-3.5" />
        </a>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1.5 truncate text-2xl font-semibold tracking-tight",
              tone === "destructive" && "text-destructive",
              tone === "success" && "text-success",
              tone === "warning" && "text-warning"
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
            tone === "warning" && "bg-warning/15 text-warning",
            tone === "default" && "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
}
