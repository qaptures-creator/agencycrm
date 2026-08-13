"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Building2, Globe, AtSign, RefreshCcw, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { StatusBadge } from "@/components/status-badge";
import { ClientForm } from "./client-form";
import { CLIENT_STATUSES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { ServiceOption } from "@/components/services-select";
import type { Client, Service, Retainer } from "@prisma/client";

type ClientWithMeta = Client & {
  services: Service[];
  retainer: Retainer | null;
  _count: { projects: number; deliverables: number; invoices: number };
};

function ClientCard({ client }: { client: ClientWithMeta }) {
  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="h-full border-l-4 p-5 transition-shadow hover:shadow-md" style={{ borderLeftColor: client.color }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{client.companyName}</p>
            <p className="truncate text-sm text-muted-foreground">{client.mainContactName}</p>
          </div>
          <StatusBadge list={CLIENT_STATUSES} value={client.status} />
        </div>

        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {client.website && (
            <div className="flex items-center gap-1.5 truncate">
              <Globe className="size-3 shrink-0" /> {client.website}
            </div>
          )}
          {client.instagram && (
            <div className="flex items-center gap-1.5 truncate">
              <AtSign className="size-3 shrink-0" /> {client.instagram}
            </div>
          )}
        </div>

        {client.services.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {client.services.slice(0, 3).map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[10px]">
                {s.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">
            {client._count.projects} project{client._count.projects === 1 ? "" : "s"}
          </span>
          <span className="font-medium">
            {client.monthlyRetainer
              ? `${formatCurrency(client.monthlyRetainer)}/mo`
              : client.oneOffValue
                ? formatCurrency(client.oneOffValue)
                : "One-off"}
          </span>
        </div>
      </Card>
    </Link>
  );
}

export function ClientsView({ clients, services }: { clients: ClientWithMeta[]; services: ServiceOption[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);

  const filtered = clients.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${c.companyName} ${c.mainContactName} ${c.email ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const retainerClients = filtered.filter((c) => c.monthlyRetainer);
  const oneOffClients = filtered.filter((c) => !c.monthlyRetainer);

  const mrr = clients
    .filter((c) => c.status === "ACTIVE")
    .reduce((sum, c) => sum + (c.monthlyRetainer ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} client{clients.length === 1 ? "" : "s"} · {formatCurrency(mrr)} MRR from active clients
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus /> Add client
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search clients…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CLIENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={clients.length === 0 ? "No clients yet" : "No clients match your filters"}
          description={
            clients.length === 0
              ? "Convert a won lead from the CRM, or add a client directly."
              : "Try adjusting your search or filters."
          }
          action={
            clients.length === 0 ? (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus /> Add client
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {retainerClients.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCcw className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Retainer Clients</h2>
                <span className="text-xs text-muted-foreground">({retainerClients.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {retainerClients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            </div>
          )}

          {oneOffClients.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">One-off Projects</h2>
                <span className="text-xs text-muted-foreground">({oneOffClients.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {oneOffClients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <EntityDialog open={addOpen} onOpenChange={setAddOpen} title="Add client">
        <ClientForm
          services={services}
          onSuccess={(client) => {
            setAddOpen(false);
            router.push(`/clients/${client.id}?tab=documents&upload=proposal`);
          }}
          onCancel={() => setAddOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
