"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/gym/members", label: "List / Map" },
  { href: "/gym/members/returning-day-passes", label: "Returning Day Passes" },
];

/**
 * "Returning Day Passes" is a real separate route (its own Server
 * Component, own data fetch) rather than a third pane inside the existing
 * client-side List/Map <Tabs> on /gym/members. Its query is a full-table
 * aggregate — materially heavier than List/Map — so it should only run
 * when that tab is actually open, not on every /gym/members load the way
 * List+Map already both do today (they're both panes of the same Tabs).
 * Styled to match TabsTrigger (src/components/ui/tabs.tsx) exactly so it
 * reads as one more tab in the Members area, even though switching to it
 * is a real navigation rather than Radix tab-switching.
 */
export function MemberSectionNav() {
  const pathname = usePathname();

  return (
    <div className="inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-secondary/70 p-1 text-muted-foreground">
      {SECTIONS.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "hover:text-foreground"
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
