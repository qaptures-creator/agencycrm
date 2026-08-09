"use client";

type TooltipEntry = {
  color?: string;
  name?: string | number;
  value?: string | number;
};

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}:</span>
          <span className="font-medium text-foreground">
            {entry.value !== undefined ? (valueFormatter ? valueFormatter(Number(entry.value)) : entry.value) : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
