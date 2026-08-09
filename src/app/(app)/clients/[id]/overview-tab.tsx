import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CLIENT_PAYMENT_STATUSES } from "@/lib/constants";
import type { Client, Service, Lead, PipelineStage } from "@prisma/client";

type ClientWithExtras = Client & {
  services: Service[];
  fromLead: (Lead & { stage: PipelineStage }) | null;
};

export function OverviewTab({ client }: { client: ClientWithExtras }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Contract & Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Field label="Monthly Retainer" value={client.monthlyRetainer ? formatCurrency(client.monthlyRetainer) : "One-off client"} />
          <Field label="Contract Start" value={formatDate(client.contractStart)} />
          <Field label="Contract Renewal / End" value={formatDate(client.contractEnd)} />
          <Field label="Payment Status" value={<StatusBadge list={CLIENT_PAYMENT_STATUSES} value={client.paymentStatus} />} />
          <Field label="Services Provided" value={
            client.services.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {client.services.map((s) => (
                  <Badge key={s.id} variant="secondary">{s.name}</Badge>
                ))}
              </div>
            ) : "—"
          } />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relationship History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {client.fromLead ? (
            <div>
              <p className="text-muted-foreground">Originated from lead</p>
              <p className="font-medium">{client.fromLead.contactName}</p>
              <p className="text-xs text-muted-foreground">Won via {client.fromLead.source || "unknown source"}</p>
              <Link href={`/crm?lead=${client.fromLead.id}`} className="mt-1 inline-block text-xs text-primary hover:underline">
                View original lead →
              </Link>
            </div>
          ) : (
            <p className="text-muted-foreground">Added directly as a client.</p>
          )}
          <p className="text-xs text-muted-foreground">Client since {formatDate(client.createdAt)}</p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {client.notes ? (
            <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
