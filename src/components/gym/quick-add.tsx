"use client";

import { useRouter } from "next/navigation";
import { Plus, Target, Inbox, ListChecks, CalendarClock, StickyNote, Dumbbell, Wrench, SprayCan, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ITEMS = [
  { label: "New Lead", href: "/gym/leads?new=1", icon: Target },
  { label: "New Enquiry", href: "/gym/enquiries?new=1", icon: Inbox },
  { label: "New Task", href: "/gym/tasks?new=1", icon: ListChecks },
  { label: "New Shift", href: "/gym/rota?new=1", icon: CalendarClock },
  { label: "New Member Note", href: "/gym/members?new=note", icon: StickyNote },
  { label: "Report Equipment Issue", href: "/gym/equipment?new=1", icon: Dumbbell },
  { label: "Maintenance Ticket", href: "/gym/maintenance?new=1", icon: Wrench },
  { label: "Cleaning Task", href: "/gym/cleaning?new=1", icon: SprayCan },
  { label: "Incident Report", href: "/gym/incidents?new=1", icon: ShieldAlert },
];

export function GymQuickAdd() {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Quick Add</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map((item) => (
          <DropdownMenuItem key={item.href} onSelect={() => router.push(item.href)}>
            <item.icon className="size-4 text-muted-foreground" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
