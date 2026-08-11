"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mail, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DotBadge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { disconnectMicrosoftAction } from "@/actions/microsoft";

export function IntegrationsPanel({
  connected,
  email,
  configured,
}: {
  connected: boolean;
  email?: string;
  configured: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnectOpen, setDisconnectOpen] = React.useState(false);

  React.useEffect(() => {
    const connectedEmail = searchParams.get("microsoft_connected");
    const error = searchParams.get("microsoft_error");
    if (connectedEmail) {
      toast.success(`Connected to Microsoft 365 as ${connectedEmail}`);
      router.replace("/settings");
    } else if (error) {
      toast.error(`Microsoft connection failed: ${error}`);
      router.replace("/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleDisconnect() {
    await disconnectMicrosoftAction();
    toast.success("Disconnected Microsoft 365");
    setDisconnectOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your Microsoft 365 mailbox to upload client documents to OneDrive and see your Outlook inbox on the dashboard.
      </p>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Mail className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Microsoft 365 (Outlook &amp; OneDrive)</p>
            {connected ? (
              <p className="truncate text-xs text-muted-foreground">Connected as {email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {configured ? "Not connected yet" : "Not configured — set MICROSOFT_CLIENT_ID/SECRET/TENANT_ID first"}
              </p>
            )}
          </div>
          {connected ? (
            <>
              <DotBadge color="#22c55e">Connected</DotBadge>
              <Button variant="outline" size="sm" onClick={() => setDisconnectOpen(true)}>
                <Unlink /> Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={!configured} asChild={configured}>
              {configured ? (
                <a href="/api/auth/microsoft/connect">
                  <Link2 /> Connect
                </a>
              ) : (
                <span>
                  <Link2 /> Connect
                </span>
              )}
            </Button>
          )}
        </div>
      </Card>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Microsoft 365?</AlertDialogTitle>
            <AlertDialogDescription>
              Document uploads and the Outlook inbox widget will stop working until you reconnect. Existing documents already in OneDrive are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:opacity-90" onClick={handleDisconnect}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
