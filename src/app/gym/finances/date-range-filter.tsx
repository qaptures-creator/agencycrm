"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "@/lib/gym/finance-range";
import { cn } from "@/lib/utils";

export function DateRangeFilter({ current, start, end }: { current: DateRangeKey; start?: string; end?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customStart, setCustomStart] = React.useState(start ?? "");
  const [customEnd, setCustomEnd] = React.useState(end ?? "");

  function setRange(key: DateRangeKey, s?: string, e?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    if (key === "custom") {
      if (s) params.set("start", s);
      else params.delete("start");
      if (e) params.set("end", e);
      else params.delete("end");
    } else {
      params.delete("start");
      params.delete("end");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {DATE_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              current === opt.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {current === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-8 w-36 text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-8 w-36 text-xs" />
          <Button size="sm" variant="outline" onClick={() => setRange("custom", customStart, customEnd)}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
