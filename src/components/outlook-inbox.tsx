import { Mail, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { formatRelativeToNow } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { GraphMessage } from "@/lib/microsoft-graph";

export function OutlookInbox({
  messages,
  microsoftConnected,
  error,
}: {
  messages: GraphMessage[];
  microsoftConnected: boolean;
  error?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold text-foreground">Inbox</CardTitle>
        {microsoftConnected && <span className="text-xs text-muted-foreground">Outlook</span>}
      </CardHeader>
      <CardContent>
        {!microsoftConnected ? (
          <EmptyState
            icon={Mail}
            title="Not connected"
            description="Connect Microsoft 365 in Settings to see your Outlook inbox here."
            className="border-none bg-transparent py-8"
          />
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load inbox"
            description={error}
            className="border-none bg-transparent py-8"
          />
        ) : messages.length === 0 ? (
          <EmptyState icon={Mail} title="No messages" description="Your inbox is empty." className="border-none bg-transparent py-8" />
        ) : (
          <ul className="space-y-1">
            {messages.map((msg) => (
              <li key={msg.id}>
                <a
                  href={msg.webLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/60"
                >
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", !msg.isRead ? "bg-primary" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", !msg.isRead ? "font-semibold" : "font-medium")}>
                        {msg.from?.emailAddress.name ?? "Unknown sender"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeToNow(msg.receivedDateTime)}</span>
                    </span>
                    <span className="block truncate text-xs text-foreground/80">{msg.subject || "(no subject)"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{msg.bodyPreview}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
