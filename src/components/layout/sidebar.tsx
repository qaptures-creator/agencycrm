"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";
import { BrandMark, BRAND_NAME } from "./brand-mark";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2 px-5">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">{BRAND_NAME}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        <NavLinks />
      </div>
      <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/50">
        Video Marketing Agency
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex h-14 items-center justify-between gap-2 px-5">
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">{BRAND_NAME}</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          <NavLinks onNavigate={onClose} />
        </div>
      </aside>
    </div>
  );
}
