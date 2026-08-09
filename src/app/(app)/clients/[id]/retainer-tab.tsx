"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { RetainerForm } from "@/app/(app)/retainers/retainer-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Client, Retainer } from "@prisma/client";

export function RetainerTab({ client, retainer }: { client: Client; retainer: Retainer | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  if (!retainer) {
    return (
      <>
        <EmptyState
          icon={RefreshCcw}
          title="No retainer set up"
          description="Set up a monthly retainer package to track usage across shoots, videos and photos."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              Set up retainer
            </Button>
          }
        />
        <EntityDialog open={open} onOpenChange={setOpen} title="Set up retainer">
          <RetainerForm clientId={client.id} onSuccess={() => { setOpen(false); router.refresh(); }} onCancel={() => setOpen(false)} />
        </EntityDialog>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{formatCurrency(retainer.monthlyRetainer)}/month</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Pencil /> Edit retainer
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <UsageCard label="Shoots" used={retainer.shootsUsed} included={retainer.shootsIncluded} />
        <UsageCard label="Videos" used={retainer.videosUsed} included={retainer.videosIncluded} />
        <UsageCard label="Photos" used={retainer.photosUsed} included={retainer.photosIncluded} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Dates</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Next Shoot</p>
            <p className="mt-0.5 font-medium">{formatDate(retainer.nextShootDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Next Payment</p>
            <p className="mt-0.5 font-medium">{formatDate(retainer.nextPaymentDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Renewal Date</p>
            <p className="mt-0.5 font-medium">{formatDate(retainer.renewalDate)}</p>
          </div>
        </CardContent>
      </Card>

      {retainer.servicesIncludedText && (
        <Card>
          <CardHeader>
            <CardTitle>Services Included</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{retainer.servicesIncludedText}</p>
          </CardContent>
        </Card>
      )}

      <EntityDialog open={open} onOpenChange={setOpen} title="Edit retainer">
        <RetainerForm clientId={client.id} retainer={retainer} onSuccess={() => { setOpen(false); router.refresh(); }} onCancel={() => setOpen(false)} />
      </EntityDialog>
    </div>
  );
}

function UsageCard({ label, used, included }: { label: string; used: number; included: number }) {
  const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;
  const over = included > 0 && used > included;
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          {used} / {included || "∞"}
        </p>
      </div>
      <Progress
        value={pct}
        className="mt-3"
        indicatorColor={over ? "var(--color-destructive)" : pct >= 100 ? "var(--color-warning)" : undefined}
      />
      {included === 0 && <p className="mt-2 text-xs text-muted-foreground">No monthly limit set.</p>}
      {over && <p className="mt-2 text-xs font-medium text-destructive">Over package limit</p>}
    </Card>
  );
}
