"use client";

import * as React from "react";
import { X, MailX, Paperclip, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { getMessageDetailAction, setMessageReadAction } from "@/actions/gym/email";
import type { MessageDetail } from "@/lib/email/message-detail";
import { formatDateTime } from "@/lib/utils";

function addressLine(a: { name: string | null; address: string | null }) {
  if (a.name && a.address) return `${a.name} <${a.address}>`;
  return a.name || a.address || "Unknown";
}

function AttachmentRow({ messageId, index, filename, sizeBytes }: { messageId: string; index: number; filename: string; sizeBytes: number }) {
  const kb = sizeBytes / 1024;
  const sizeLabel = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
  return (
    <a
      href={`/api/gym/email/attachment?messageId=${encodeURIComponent(messageId)}&index=${index}`}
      className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm hover:bg-secondary/40"
    >
      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{filename}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{sizeLabel}</span>
      <Download className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function MessageDetailPane({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const [detail, setDetail] = React.useState<MessageDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showImages, setShowImages] = React.useState(false);
  const [markingUnread, setMarkingUnread] = React.useState(false);

  React.useEffect(() => {
    // Parent remounts this component (key={messageId}) on selection change,
    // so state above already starts fresh — no manual reset needed here.
    let cancelled = false;
    getMessageDetailAction(messageId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load message");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  async function markUnread() {
    setMarkingUnread(true);
    try {
      await setMessageReadAction(messageId, false);
      toast.success("Marked as unread");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setMarkingUnread(false);
    }
  }

  const iframeSrcDoc = React.useMemo(() => {
    if (!detail?.htmlSafe) return null;
    return showImages ? detail.htmlSafe.replaceAll('data-safe-src="', 'src="') : detail.htmlSafe;
  }, [detail, showImages]);

  const hasBlockedImages = !!detail?.htmlSafe && detail.htmlSafe.includes("data-safe-src=");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={markUnread} disabled={markingUnread || loading}>
            <MailX className="size-3.5" />
            Mark unread
          </Button>
        </div>
        <Button size="icon" variant="ghost" className="size-8 md:hidden" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {loading && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading message…
          </div>
        )}

        {error && <EmptyState icon={MailX} title="Couldn't load this message" description={error} className="border-none bg-transparent" />}

        {detail && !loading && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-semibold">{detail.subject || "(no subject)"}</h2>
              <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                <p>From: {detail.from ? addressLine(detail.from) : "Unknown"}</p>
                {detail.to.length > 0 && <p>To: {detail.to.map(addressLine).join(", ")}</p>}
                {detail.cc.length > 0 && <p>Cc: {detail.cc.map(addressLine).join(", ")}</p>}
                {detail.date && <p>{formatDateTime(detail.date)}</p>}
              </div>
            </div>

            {detail.attachments.length > 0 && (
              <div className="space-y-1.5">
                {detail.attachments.map((a) => (
                  <AttachmentRow key={a.index} messageId={messageId} index={a.index} filename={a.filename} sizeBytes={a.sizeBytes} />
                ))}
              </div>
            )}

            {hasBlockedImages && !showImages && (
              <button
                onClick={() => setShowImages(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/40"
              >
                <ImageIcon className="size-3.5" />
                Images are blocked to protect your privacy. Load external images
              </button>
            )}

            <div className="rounded-lg border border-border">
              {detail.htmlSafe ? (
                <iframe
                  sandbox=""
                  srcDoc={iframeSrcDoc ?? undefined}
                  className="w-full rounded-lg bg-white"
                  style={{ height: 500, border: "none" }}
                  title="Email content"
                />
              ) : (
                <pre className="max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words p-4 text-sm">
                  {detail.textPlain || "(no content)"}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
