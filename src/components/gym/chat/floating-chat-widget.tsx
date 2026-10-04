"use client";

import * as React from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/gym/permissions";
import { cn, initials } from "@/lib/utils";
import type { ChatMessageRow } from "@/lib/gym/chat";

const OPEN_POLL_MS = 12_000;
const CLOSED_POLL_MS = 45_000;
const MAX_LENGTH = 4000;

function formatTime(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Floating team-wide chat — one shared room, no DMs. Mounted once in the
 * gym layout so it persists across every page. Polls rather than holding a
 * live connection (simple, cheap on Railway): every 12s while open, every
 * 45s while closed (just a count, for the unread badge). Read-state is
 * tracked per-user in localStorage on this browser — it doesn't sync
 * across devices, which is an accepted simplification for a first version.
 * Messages older than 90 days are hard-deleted server-side (see
 * src/lib/gym/chat.ts); nothing client-side needs to know about that.
 */
export function FloatingChatWidget({ currentUser }: { currentUser: { id: string; name: string; accessRole: string } }) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessageRow[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const lastSeenRef = React.useRef<string>(new Date(0).toISOString());
  const latestMessageAtRef = React.useRef<string>(new Date(0).toISOString());
  const listRef = React.useRef<HTMLDivElement>(null);
  const storageKey = `mm-chat-last-seen-${currentUser.id}`;

  React.useEffect(() => {
    try {
      lastSeenRef.current = window.localStorage.getItem(storageKey) ?? new Date(0).toISOString();
    } catch {
      // localStorage unavailable (private mode, blocked) — fall back to "everything unread", harmless.
    }
  }, [storageKey]);

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  const persistLastSeen = React.useCallback(
    (iso: string) => {
      lastSeenRef.current = iso;
      try {
        window.localStorage.setItem(storageKey, iso);
      } catch {
        // Best-effort only.
      }
    },
    [storageKey]
  );

  // Initial load — always fetch the latest page once, regardless of open
  // state, so the unread badge is correct from first paint.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/gym/chat/messages");
        if (!res.ok) return;
        const data: { messages: ChatMessageRow[] } = await res.json();
        if (cancelled) return;
        setMessages(data.messages);
        const latest = data.messages[data.messages.length - 1];
        latestMessageAtRef.current = latest?.createdAt ?? new Date().toISOString();
        const unseen = data.messages.filter((m) => m.createdAt > lastSeenRef.current).length;
        setUnreadCount(unseen);
        setLoaded(true);
      } catch {
        // Silent — chat is a convenience feature, not critical path.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Polling — cadence and payload depend on open/closed.
  React.useEffect(() => {
    if (!loaded) return;
    const tick = async () => {
      try {
        if (open) {
          const res = await fetch(`/api/gym/chat/messages?since=${encodeURIComponent(latestMessageAtRef.current)}`);
          if (!res.ok) return;
          const data: { messages: ChatMessageRow[] } = await res.json();
          if (data.messages.length > 0) {
            setMessages((prev) => [...prev, ...data.messages]);
            latestMessageAtRef.current = data.messages[data.messages.length - 1].createdAt;
            persistLastSeen(latestMessageAtRef.current);
            scrollToBottom();
          }
        } else {
          const res = await fetch(`/api/gym/chat/messages?since=${encodeURIComponent(lastSeenRef.current)}&count=1`);
          if (!res.ok) return;
          const data: { count: number } = await res.json();
          setUnreadCount(data.count);
        }
      } catch {
        // Skip this tick — next poll will catch up.
      }
    };
    const interval = setInterval(tick, open ? OPEN_POLL_MS : CLOSED_POLL_MS);
    return () => clearInterval(interval);
  }, [open, loaded, persistLastSeen, scrollToBottom]);

  function handleOpen() {
    setOpen(true);
    setUnreadCount(0);
    persistLastSeen(latestMessageAtRef.current);
    scrollToBottom();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/gym/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const data: { message: ChatMessageRow } = await res.json();
      setMessages((prev) => [...prev, data.message]);
      latestMessageAtRef.current = data.message.createdAt;
      persistLastSeen(data.message.createdAt);
      setInput("");
      scrollToBottom();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[480px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/40">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-secondary/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Team Chat</p>
              <p className="text-xs text-muted-foreground">Everyone · messages auto-clear after 90 days</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin px-3 py-3">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-xs text-muted-foreground">No messages yet — say hello.</p>
            ) : (
              messages.map((m) => {
                const mine = m.author.id === currentUser.id;
                return (
                  <div key={m.id} className={cn("flex items-start gap-2", mine && "flex-row-reverse")}>
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                      {initials(m.author.name)}
                    </div>
                    <div className={cn("max-w-[75%] space-y-0.5", mine && "items-end text-right")}>
                      <div className={cn("flex items-baseline gap-1.5 text-[11px] text-muted-foreground", mine && "flex-row-reverse")}>
                        <span className="font-medium text-foreground">{mine ? "You" : m.author.name}</span>
                        <span>{roleLabel(m.author.accessRole)}</span>
                        <span>·</span>
                        <span>{formatTime(m.createdAt)}</span>
                      </div>
                      <div
                        className={cn(
                          "whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
                          mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                        )}
                      >
                        {m.body}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="flex shrink-0 items-end gap-2 border-t border-border p-2.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Message the team…"
              maxLength={MAX_LENGTH}
              rows={1}
              className="max-h-24 flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || sending} className="shrink-0">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
      )}

      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-label={open ? "Close team chat" : "Open team chat"}
        className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-black/30 transition-transform hover:scale-105"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
