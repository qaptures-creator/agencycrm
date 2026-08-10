"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, User, Inbox, Target, UserCog, Dumbbell, ListChecks, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GymSearchResult } from "@/app/api/gym/search/route";

const TYPE_ICON: Record<GymSearchResult["type"], React.ComponentType<{ className?: string }>> = {
  Member: User,
  Enquiry: Inbox,
  Lead: Target,
  Staff: UserCog,
  Equipment: Dumbbell,
  Task: ListChecks,
};

export function GymGlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GymSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/gym/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const grouped = results.reduce<Record<string, GymSearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-secondary/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search members, staff, tasks…</span>
        <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <Command
            shouldFilter={false}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              {loading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <Search className="size-4 text-muted-foreground" />
              )}
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search members, enquiries, leads, staff, equipment, tasks…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto scrollbar-thin p-2">
              {query.trim().length < 2 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search across the CRM.
                </div>
              )}
              {query.trim().length >= 2 && !loading && results.length === 0 && (
                <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{query}&rdquo;.
                </Command.Empty>
              )}
              {Object.entries(grouped).map(([type, items]) => {
                const Icon = TYPE_ICON[type as GymSearchResult["type"]];
                return (
                  <Command.Group
                    key={type}
                    heading={type + "s"}
                    className="px-2 py-1.5 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2"
                  >
                    {items.map((r) => (
                      <Command.Item
                        key={r.type + r.id}
                        value={r.type + r.id}
                        onSelect={() => go(r.href)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground data-[selected=true]:bg-secondary"
                        )}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium">{r.title}</span>
                          <span className="truncate text-xs text-muted-foreground">{r.subtitle}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
