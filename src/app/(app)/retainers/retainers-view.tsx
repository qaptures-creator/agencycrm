"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { RetainerForm } from "./retainer-form";
import { formatCurrency, formatDate, isOverdue, cn } from "@/lib/utils";
import type { Client, Retainer } from "@prisma/client";

type ClientWithRetainer = Client & { retainer: Retainer | null };

export function RetainersView({ clients }: { clients: ClientWithRetainer[] }) {
  const router = useRouter();
  const [dialogFor, setDialogFor] = React.useState<ClientWithRetainer | null>(null);

  const withRetainer = clients.filter((c) => c.retainer);
  const totalMRR = withRetainer.reduce((sum, c) => sum + (c.retainer?.monthlyRetainer ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Retainers</h1>
        <p className="text-sm text-muted-foreground">
          {withRetainer.length} client{withRetainer.length === 1 ? "" : "s"} on retainer · {formatCurrency(totalMRR)}/mo combined
        </p>
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={RefreshCcw} title="No active clients yet" description="Add clients and set up monthly retainer packages to track usage here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/clients/${client.id}`} className="truncate font-semibold hover:underline">
                    {client.companyName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {client.retainer ? `${formatCurrency(client.retainer.monthlyRetainer)}/mo` : "No retainer set up"}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setDialogFor(client)}>
                  <Pencil className="size-3.5" />
                </Button>
              </div>

              {client.retainer ? (
                <>
                  <div className="mt-3 space-y-2">
                    <UsageRow label="Shoots" used={client.retainer.shootsUsed} included={client.retainer.shootsIncluded} />
                    <UsageRow label="Videos" used={client.retainer.videosUsed} included={client.retainer.videosIncluded} />
                    <UsageRow label="Photos" used={client.retainer.photosUsed} included={client.retainer.photosIncluded} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">Next shoot</p>
                      <p className="font-medium">{formatDate(client.retainer.nextShootDate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next payment</p>
                      <p className={cn("font-medium", client.retainer.nextPaymentDate && isOverdue(client.retainer.nextPaymentDate) && "text-destructive")}>
                        {formatDate(client.retainer.nextPaymentDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Renewal</p>
                      <p className="font-medium">{formatDate(client.retainer.renewalDate)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setDialogFor(client)}>
                  Set up retainer
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <EntityDialog open={!!dialogFor} onOpenChange={(o) => !o && setDialogFor(null)} title={`${dialogFor?.retainer ? "Edit" : "Set up"} retainer — ${dialogFor?.companyName ?? ""}`}>
        {dialogFor && (
          <RetainerForm
            clientId={dialogFor.id}
            retainer={dialogFor.retainer}
            onSuccess={() => {
              setDialogFor(null);
              router.refresh();
            }}
            onCancel={() => setDialogFor(null)}
          />
        )}
      </EntityDialog>
    </div>
  );
}

function UsageRow({ label, used, included }: { label: string; used: number; included: number }) {
  const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;
  const over = included > 0 && used > included;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", over && "text-destructive")}>{used} / {included || "∞"}</span>
      </div>
      <Progress value={pct} className="mt-1 h-1" indicatorColor={over ? "var(--color-destructive)" : undefined} />
    </div>
  );
}
