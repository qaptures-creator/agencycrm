"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleIntegrationConnectionAction } from "@/actions/gym/integrations";

export function WebsiteToggle({ connected }: { connected: boolean }) {
  const [pending, startTransition] = React.useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleIntegrationConnectionAction("WEBSITE", !connected);
        toast.success(connected ? "Marked as not connected" : "Marked as connected");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
      }
    });
  }

  return (
    <Button size="sm" variant={connected ? "outline" : "default"} disabled={pending} onClick={handleToggle}>
      {pending ? "Updating…" : connected ? "Mark as Not Connected" : "Mark as Connected"}
    </Button>
  );
}
