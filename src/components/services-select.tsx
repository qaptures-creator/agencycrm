"use client";

import * as React from "react";
import { Plus, Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createService } from "@/actions/leads";

export type ServiceOption = { id: string; name: string };

export function ServicesSelect({
  services,
  selectedIds,
  onChange,
  onServiceCreated,
}: {
  services: ServiceOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onServiceCreated?: (service: ServiceOption) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const selected = services.filter((s) => selectedIds.includes(s.id));
  const filtered = services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = services.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
  }

  async function handleCreate() {
    if (!query.trim() || creating) return;
    setCreating(true);
    try {
      const service = await createService(query.trim());
      onServiceCreated?.(service);
      onChange([...selectedIds, service.id]);
      setQuery("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground">
              {selected.length > 0 ? `${selected.length} service${selected.length > 1 ? "s" : ""} selected` : "Select services…"}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              placeholder="Search or add a service…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin p-1">
            {filtered.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border border-input",
                    selectedIds.includes(s.id) && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {selectedIds.includes(s.id) && <Check className="size-3" />}
                </span>
                {s.name}
              </button>
            ))}
            {filtered.length === 0 && query.trim().length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No services yet.</p>
            )}
            {query.trim().length > 0 && !exactMatch && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-secondary disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                Add &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              {s.name}
              <button type="button" onClick={() => toggle(s.id)} className="rounded-full p-0.5 hover:bg-foreground/10">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
