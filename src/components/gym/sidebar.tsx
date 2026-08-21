"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { navItemsForRole } from "@/lib/gym/nav-config";
import { roleLabel, type GymAccessRole } from "@/lib/gym/permissions";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/gym/auth";
import { initials } from "@/lib/utils";
import type { NavBadgeCounts } from "@/lib/gym/nav-badges";

type CurrentUser = { name: string; accessRole: string; position?: string | null };

function NavBadge({ count, collapsed }: { count: number; collapsed?: boolean }) {
  if (count <= 0) return null;
  if (collapsed) {
    return (
      <span className="absolute right-1 top-1 flex size-2 rounded-full bg-destructive" aria-label={`${count} need attention`} />
    );
  }
  return (
    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLinks({
  role,
  collapsed,
  onNavigate,
  badges,
}: {
  role: GymAccessRole;
  collapsed?: boolean;
  onNavigate?: () => void;
  badges?: NavBadgeCounts;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
      {items.map((item) => {
        const active = item.href === "/gym" ? pathname === "/gym" : pathname.startsWith(item.href);
        const Icon = item.icon;
        const badgeCount = badges?.[item.href as keyof NavBadgeCounts] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-[18px] shrink-0 transition-colors",
                active ? "text-sidebar-primary" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground"
              )}
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
            <NavBadge count={badgeCount} collapsed={collapsed} />
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex h-16 items-center gap-2.5 px-5", collapsed && "justify-center px-0")}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <span className="font-display text-sm font-bold">MM</span>
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="font-display truncate text-[13px] font-semibold uppercase tracking-wide text-sidebar-foreground">
            Muscle Massacre
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/45">
            Command Centre
          </p>
        </div>
      )}
    </div>
  );
}

function UserFooter({ user, collapsed }: { user: CurrentUser; collapsed?: boolean }) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className={cn("flex items-center gap-2.5", collapsed && "flex-col")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initials(user.name)}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/50">{roleLabel(user.accessRole)}</p>
          </div>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            title="Log out"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function GymSidebar({ user, badges }: { user: CurrentUser; badges?: NavBadgeCounts }) {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("mm-sidebar-collapsed");
    if (stored) setCollapsed(stored === "1");
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem("mm-sidebar-collapsed", prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      <Brand collapsed={collapsed} />
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        <NavLinks role={user.accessRole as GymAccessRole} collapsed={collapsed} badges={badges} />
      </div>
      <UserFooter user={user} collapsed={collapsed} />
      <button
        onClick={toggle}
        className="flex h-9 items-center justify-center gap-2 border-t border-sidebar-border text-xs text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
      </button>
    </aside>
  );
}

export function GymMobileSidebar({
  open,
  onClose,
  user,
  badges,
}: {
  open: boolean;
  onClose: () => void;
  user: CurrentUser;
  badges?: NavBadgeCounts;
}) {
  // Lock background scroll while the drawer is open, and let Escape close it.
  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Rendered via portal directly into <body>: the topbar uses backdrop-blur,
  // and any ancestor with a filter/backdrop-filter/transform establishes a
  // new containing block for `position: fixed` descendants — which silently
  // confined this drawer's "fixed inset-0" to the header's own box (~64px
  // tall) instead of the viewport. Portaling out from under that ancestor is
  // the actual fix; each layer below is independently `fixed` to the real
  // viewport rather than relying on a flex-stretch parent.
  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-10 flex h-dvh w-[85vw] max-w-[320px] flex-col",
          "border-r border-sidebar-border bg-sidebar",
          "pt-[env(safe-area-inset-top)]"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border pr-2">
          <Brand />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          <NavLinks role={user.accessRole as GymAccessRole} onNavigate={onClose} badges={badges} />
        </div>
        <div className="pb-[env(safe-area-inset-bottom)]">
          <UserFooter user={user} />
        </div>
      </aside>
    </div>,
    document.body
  );
}
