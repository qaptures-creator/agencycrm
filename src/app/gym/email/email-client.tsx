"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/sheet";
import { FolderNav, type FolderCounts } from "./folder-nav";
import { MessageList } from "./message-list";
import { MessageDetailPane } from "./message-detail-pane";
import { syncEmailAction, syncEmailIfStaleAction, loadOlderMessagesAction } from "@/actions/gym/email";
import type { WellKnownFolder } from "@/lib/email/types";
import type { EmailListRow } from "@/lib/gym/email-data";

const FOLDER_LABELS: Record<WellKnownFolder, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  spam: "Spam",
  trash: "Trash",
};

export function EmailClient({
  folder,
  counts,
  initialRows,
  initialHasMore,
  initialUnreadOnly,
  selectedMessageId,
}: {
  folder: WellKnownFolder;
  counts: FolderCounts;
  initialRows: EmailListRow[];
  initialHasMore: boolean;
  initialUnreadOnly: boolean;
  selectedMessageId: string | null;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [mobileFoldersOpen, setMobileFoldersOpen] = React.useState(false);
  const unreadOnly = initialUnreadOnly;

  // Auto-sync on page load if the last run is stale — never blocks render.
  const autoSyncRan = React.useRef(false);
  React.useEffect(() => {
    if (autoSyncRan.current) return;
    autoSyncRan.current = true;
    syncEmailIfStaleAction()
      .then((r) => {
        if (!r.skipped && r.ok) router.refresh();
      })
      .catch(() => {
        // Silent — the manual Sync Mail button surfaces errors explicitly.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToFolder(role: WellKnownFolder) {
    setMobileFoldersOpen(false);
    router.push(`/gym/email?folder=${role}`);
  }

  function goToUnread() {
    setMobileFoldersOpen(false);
    router.push(`/gym/email?folder=inbox&unread=1`);
  }

  function selectMessage(id: string) {
    router.push(`/gym/email?folder=${folder}${unreadOnly ? "&unread=1" : ""}&message=${id}`);
  }

  function closeDetail() {
    router.push(`/gym/email?folder=${folder}${unreadOnly ? "&unread=1" : ""}`);
    router.refresh();
  }

  async function runSync() {
    setSyncing(true);
    try {
      const result = await syncEmailAction();
      if (result.ok) {
        toast.success("Mail synced");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const result = await loadOlderMessagesAction(folder);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load older messages");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Email</h1>
          <p className="text-sm text-muted-foreground">The Muscle Massacre mailbox — read, reply, and track from inside the CRM.</p>
        </div>
      </div>

      <div className="grid h-[72vh] min-h-[520px] grid-cols-1 gap-4 md:grid-cols-[220px_340px_1fr]">
        {/* Desktop folder sidebar */}
        <div className="hidden overflow-y-auto rounded-xl border border-border bg-card p-3 md:block">
          <FolderNav folder={folder} unreadOnly={unreadOnly} counts={counts} syncing={syncing} onSelectFolder={goToFolder} onSelectUnread={goToUnread} onSync={runSync} />
        </div>

        {/* Message list — hidden on mobile once a message is open */}
        <div className={`overflow-hidden rounded-xl border border-border bg-card ${selectedMessageId ? "hidden md:block" : ""}`}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2 md:hidden">
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setMobileFoldersOpen(true)}>
              <Menu className="size-4" />
              {unreadOnly ? "Unread" : FOLDER_LABELS[folder]}
            </Button>
            <Button size="sm" variant="ghost" onClick={runSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync"}
            </Button>
          </div>
          <div className="h-full">
            <MessageList rows={initialRows} selectedId={selectedMessageId} hasMore={initialHasMore} loadingMore={loadingMore} onSelect={selectMessage} onLoadMore={loadMore} />
          </div>
        </div>

        {/* Detail pane */}
        <div className={`overflow-hidden rounded-xl border border-border bg-card ${selectedMessageId ? "" : "hidden md:block"}`}>
          {selectedMessageId ? (
            <MessageDetailPane key={selectedMessageId} messageId={selectedMessageId} onClose={closeDetail} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Select a message to read it.
            </div>
          )}
        </div>
      </div>

      <Sheet open={mobileFoldersOpen} onOpenChange={setMobileFoldersOpen}>
        <SheetContent side="left" className="p-0">
          <SheetHeader>
            <SheetTitle>Folders</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <FolderNav folder={folder} unreadOnly={unreadOnly} counts={counts} syncing={syncing} onSelectFolder={goToFolder} onSelectUnread={goToUnread} onSync={runSync} />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
