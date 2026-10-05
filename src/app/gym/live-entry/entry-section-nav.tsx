"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/gym/live-entry", label: "Live Feed" },
  { href: "/gym/live-entry/statistics", label: "Entry Statistics" },
];

/** Same route-based-tab pattern as MemberSectionNav (src/app/gym/members/
 * member-section-nav.tsx): Entry Statistics is a real separate route so its
 * daily aggregate query only runs when that tab is actually open, not on
 * every /gym/live-entry load the way the 6s-polling Live Feed does. */
export function EntrySectionNav() {
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
