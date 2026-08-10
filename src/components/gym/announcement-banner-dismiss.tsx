"use client";

import * as React from "react";
import { Megaphone, Pin, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnnouncementBannerDismiss({
  title,
  body,
  pinned,
}: {
  title: string;
  body: string;
  pinned: boolean;
}) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4")}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {pinned ? <Pin className="size-4" /> : <Megaphone className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{body}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Dismiss announcement"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
