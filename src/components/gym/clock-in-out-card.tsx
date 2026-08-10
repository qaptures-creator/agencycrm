"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clockInAction, clockOutAction } from "@/actions/gym/attendance";

export function ClockInOutCard({
  clockedIn,
  clockInAt,
  shiftLabel,
}: {
  clockedIn: boolean;
  clockInAt: string | null;
  shiftLabel: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function handleClockIn() {
    startTransition(async () => {
      try {
        await clockInAction();
        toast.success("Clocked in");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to clock in");
      }
    });
  }

  function handleClockOut() {
    startTransition(async () => {
      try {
        await clockOutAction();
        toast.success("Clocked out");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to clock out");
      }
    });
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Clock className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {clockedIn
                ? `Clocked in at ${clockInAt ? new Date(clockInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}`
                : "You're not clocked in"}
            </p>
            <p className="text-xs text-muted-foreground">{shiftLabel ?? "No shift scheduled today"}</p>
          </div>
        </div>
        {clockedIn ? (
          <Button size="sm" variant="outline" onClick={handleClockOut} disabled={pending}>
            Clock Out
          </Button>
        ) : (
          <Button size="sm" onClick={handleClockIn} disabled={pending}>
            Clock In
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
