import Link from "next/link";
import { POS_RANGE_PRESETS } from "@/lib/gym/integrations/goodtill-analytics";
import { cn } from "@/lib/utils";

export function PosRangeFilter({ active, from, to }: { active: string; from?: string; to?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {POS_RANGE_PRESETS.map((p) => (
          <Link
            key={p.value}
            href={p.value === "custom" ? "#pos-custom-range" : `/gym/shake-bar?posRange=${p.value}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active === p.value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form
        id="pos-custom-range"
        method="get"
        action="/gym/shake-bar"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-1.5"
      >
        <input type="hidden" name="posRange" value="custom" />
        <label className="text-xs text-muted-foreground">From</label>
        <input type="date" name="posFrom" defaultValue={from} className="h-7 rounded-md border border-input bg-transparent px-2 text-xs" />
        <label className="text-xs text-muted-foreground">To</label>
        <input type="date" name="posTo" defaultValue={to} className="h-7 rounded-md border border-input bg-transparent px-2 text-xs" />
        <button type="submit" className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
          Apply
        </button>
      </form>
    </div>
  );
}
