"use client";

import { Inbox, MailOpen, Send, FileEdit, ShieldAlert, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WellKnownFolder } from "@/lib/email/types";

export type FolderCounts = { inbox: number; unread: number; sent: number; drafts: number; spam: number; trash: number };

const MAILBOX_FOLDERS: { role: WellKnownFolder; label: string; icon: typeof Inbox }[] = [
  { role: "inbox", label: "Inbox", icon: Inbox },
  { role: "sent", label: "Sent", icon: Send },
  { role: "drafts", label: "Drafts", icon: FileEdit },
  { role: "spam", label: "Spam", icon: ShieldAlert },
  { role: "trash", label: "Trash", icon: Trash2 },
];

function FolderRow({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof Inbox;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="size-4" />
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-medium", active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
          {count}
        </span>
      )}
    </button>
  );
}

export function FolderNav({
  folder,
  unreadOnly,
  counts,
  syncing,
  onSelectFolder,
  onSelectUnread,
  onSync,
}: {
  folder: WellKnownFolder;
  unreadOnly: boolean;
  counts: FolderCounts;
  syncing: boolean;
  onSelectFolder: (role: WellKnownFolder) => void;
  onSelectUnread: () => void;
  onSync: () => void;
}) {
  return (
    <div className="space-y-4">
      <Button size="sm" variant="outline" className="w-full justify-center gap-1.5" onClick={onSync} disabled={syncing}>
        <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
        {syncing ? "Syncing…" : "Sync Mail"}
      </Button>

      <div className="space-y-0.5">
        <FolderRow icon={Inbox} label="Inbox" count={counts.inbox} active={folder === "inbox" && !unreadOnly} onClick={() => onSelectFolder("inbox")} />
        <FolderRow icon={MailOpen} label="Unread" count={counts.unread} active={folder === "inbox" && unreadOnly} onClick={onSelectUnread} />
      </div>

      <div className="space-y-0.5">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mailbox</p>
        {MAILBOX_FOLDERS.filter((f) => f.role !== "inbox").map((f) => (
          <FolderRow key={f.role} icon={f.icon} label={f.label} count={counts[f.role]} active={folder === f.role} onClick={() => onSelectFolder(f.role)} />
        ))}
      </div>
    </div>
  );
}
