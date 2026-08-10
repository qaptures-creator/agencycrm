"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { navItemsForRole } from "@/lib/gym/nav-config";
import { roleLabel, type GymAccessRole } from "@/lib/gym/permissions";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/gym/auth";
import { initials } from "@/lib/utils";

type CurrentUser = { name: string; accessRole: string; position?: string | null };

function NavLinks({
  role,
  collapsed,
  onNavigate,
}: {
  role: GymAccessRole;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
      {items.map((item) => {
        const active = item.href === "/gym" ? pathname === "/gym" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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

export function GymSidebar({ user }: { user: CurrentUser }) {
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
        <NavLinks role={user.accessRole as GymAccessRole} collapsed={collapsed} />
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
}: {
  open: boolean;
  onClose: () => void;
  user: CurrentUser;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative flex w-72 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center justify-between">
          <Brand />
          <button onClick={onClose} className="mr-4 rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          <NavLinks role={user.accessRole as GymAccessRole} onNavigate={onClose} />
        </div>
        <UserFooter user={user} />
      </aside>
    </div>
  );
}
