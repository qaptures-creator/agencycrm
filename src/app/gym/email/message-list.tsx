"use client";

import { Paperclip, Star, Mail as MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime, cn } from "@/lib/utils";
import type { EmailListRow } from "@/lib/gym/email-data";

export function MessageList({
  rows,
  selectedId,
  hasMore,
  loadingMore,
  onSelect,
  onLoadMore,
}: {
  rows: EmailListRow[];
  selectedId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={MailIcon} title="No messages" description="Nothing here yet." className="border-none bg-transparent" />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 divide-y divide-border overflow-y-auto scrollbar-thin">
        {rows.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={cn(
              "flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors",
              selectedId === m.id ? "bg-primary/10" : "hover:bg-secondary/30"
            )}
          >
            <div className="flex items-center gap-2">
              {!m.isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              <p className={cn("min-w-0 flex-1 truncate text-sm", !m.isRead ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                {m.fromName || m.fromAddress || "Unknown sender"}
              </p>
              {m.isFlagged && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
              {m.hasAttachments && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="shrink-0 text-[11px] text-muted-foreground">{m.receivedAt ? formatDateTime(m.receivedAt) : ""}</span>
            </div>
            <p className={cn("truncate text-sm", !m.isRead ? "text-foreground" : "text-muted-foreground")}>{m.subject || "(no subject)"}</p>
          </button>
        ))}
      </div>
      {hasMore && (
        <div className="border-t border-border p-3">
          <Button size="sm" variant="outline" className="w-full" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
