"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn, formatRelativeToNow } from "@/lib/utils";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/actions/gym/notifications";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationsBell({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsReadAction()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
            )}
            {notifications.map((n) => {
              const content = (
                <div
                  className={cn(
                    "flex flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-secondary/60",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    <p className="font-medium">{n.title}</p>
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground">{formatRelativeToNow(n.createdAt)}</p>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => markNotificationReadAction(n.id)}>
                  {content}
                </Link>
              ) : (
                <button key={n.id} onClick={() => markNotificationReadAction(n.id)} className="block w-full text-left">
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
