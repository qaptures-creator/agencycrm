"use client";

import * as React from "react";
import { MapPin, Users, Ruler, PieChart, AlertCircle, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { EntityDialog } from "@/components/entity-dialog";
import { MEMBERSHIP_STATUSES } from "@/lib/gym/constants";
import { formatDateTime } from "@/lib/utils";
import { retryGeocodingAction, searchMapLocationAction } from "@/actions/gym/member-map";
import { MemberMapCanvas, type FlyToTarget } from "./member-map-canvas";
import type { MapPoint, MapStats, AreaBreakdownRow, DistanceBuckets, UnmappedMemberRow } from "@/lib/gym/member-geo";

type MapApiResponse = {
  points: MapPoint[];
  stats: MapStats;
  areaBreakdown: AreaBreakdownRow[];
  distanceBuckets: DistanceBuckets;
  unmapped: UnmappedMemberRow[];
  gymLocation: { name: string; latitude: number; longitude: number } | null;
  geocodeSync: { lastRunAt: string | null; lastRunStatus: string | null; geocodedCount: number | null; failedCount: number | null } | null;
};

function miles(v: number | null) {
  return v == null ? "—" : `${v.toFixed(1)} mi`;
}
function pct(v: number | null) {
  return v == null ? "—" : `${Math.round(v)}%`;
}

export function MemberMapView({ plans, mapboxToken }: { plans: { id: string; name: string }[]; mapboxToken: string | undefined }) {
  const [status, setStatus] = React.useState<string>("");
  const [planId, setPlanId] = React.useState<string>("");
  const [joinedFrom, setJoinedFrom] = React.useState("");
  const [joinedTo, setJoinedTo] = React.useState("");

  const [data, setData] = React.useState<MapApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [flyTo, setFlyTo] = React.useState<FlyToTarget | null>(null);
  const flyToNonce = React.useRef(0);

  const [unmappedOpen, setUnmappedOpen] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (planId) params.set("planId", planId);
      if (joinedFrom) params.set("joinedFrom", joinedFrom);
      if (joinedTo) params.set("joinedTo", joinedTo);
      const res = await fetch(`/api/gym/members/map?${params.toString()}`);
      if (!res.ok) throw new Error("Could not load map data");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [status, planId, joinedFrom, joinedTo]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await searchMapLocationAction(searchQuery);
      if (!result) {
        toast.error(`No location found for "${searchQuery}"`);
        return;
      }
      flyToNonce.current += 1;
      setFlyTo({ latitude: result.latitude, longitude: result.longitude, zoom: 12, nonce: flyToNonce.current });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const result = await retryGeocodingAction();
      toast.success(`Geocoded ${result.ok} of ${result.candidates} — ${result.failed} failed, ${result.noPostcode} had no postcode`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  const stats = data?.stats;
  const buckets = data?.distanceBuckets;

  return (
    <div className="space-y-6">
      {!data?.gymLocation && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
          <AlertCircle className="size-4 shrink-0" />
          Gym location isn&apos;t set yet — distances can&apos;t be calculated until an address is geocoded in Settings.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Mapped Members" value={stats?.mapped ?? "—"} icon={Users} />
        <StatCard label="Average Distance" value={miles(stats?.avgDistanceMiles ?? null)} icon={Ruler} />
        <StatCard label="Within 5 Miles" value={pct(stats?.within5MilesPct ?? null)} icon={MapPin} tone="success" />
        <button type="button" onClick={() => setUnmappedOpen(true)} className="text-left" disabled={!stats?.unmapped}>
          <StatCard label="Unmapped" value={stats?.unmapped ?? "—"} icon={AlertCircle} tone={stats && stats.unmapped > 0 ? "warning" : "default"} />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-[140px] space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {MEMBERSHIP_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px] space-y-1.5">
          <label className="text-xs text-muted-foreground">Membership Type</label>
          <Select value={planId || "ALL"} onValueChange={(v) => setPlanId(v === "ALL" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Joined from</label>
          <Input type="date" className="h-9 w-[150px]" value={joinedFrom} onChange={(e) => setJoinedFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Joined to</label>
          <Input type="date" className="h-9 w-[150px]" value={joinedTo} onChange={(e) => setJoinedTo(e.target.value)} />
        </div>

        <form onSubmit={handleSearch} className="ml-auto flex items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Go to area</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SL6, Maidenhead, Slough…"
                className="h-9 w-[200px] pl-8"
              />
            </div>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={searching}>
            {searching ? "…" : "Go"}
          </Button>
        </form>

        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleRetry} disabled={retrying}>
          <RefreshCw className={retrying ? "size-3.5 animate-spin" : "size-3.5"} />
          {retrying ? "Retrying…" : "Retry Failed"}
        </Button>
      </div>

      {error ? (
        <EmptyState icon={AlertCircle} title="Couldn't load the map" description={error} />
      ) : (
        <MemberMapCanvas points={data?.points ?? []} gymLocation={data?.gymLocation ?? null} flyTo={flyTo} mapboxToken={mapboxToken} />
      )}

      {buckets && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-secondary/20 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            Within 3mi: <span className="font-medium text-foreground">{buckets.within3}</span>
          </span>
          <span>
            Within 5mi: <span className="font-medium text-foreground">{buckets.within5}</span>
          </span>
          <span>
            Within 10mi: <span className="font-medium text-foreground">{buckets.within10}</span>
          </span>
          <span>
            10mi+: <span className="font-medium text-foreground">{buckets.over10}</span>
          </span>
          {data?.geocodeSync?.lastRunAt && (
            <span className="ml-auto">Last geocode run: {formatDateTime(data.geocodeSync.lastRunAt)}</span>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <PieChart className="size-4" />
            Area Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.areaBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mapped members yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">% of Mapped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.areaBreakdown.map((row) => (
                  <TableRow
                    key={row.area}
                    className="cursor-pointer"
                    onClick={async () => {
                      try {
                        const result = await searchMapLocationAction(row.area);
                        if (result) {
                          flyToNonce.current += 1;
                          setFlyTo({ latitude: result.latitude, longitude: result.longitude, zoom: 12, nonce: flyToNonce.current });
                        }
                      } catch {
                        // best-effort — clicking a row is a convenience, not critical
                      }
                    }}
                  >
                    <TableCell className="font-medium">{row.area}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.pct.toFixed(0)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EntityDialog open={unmappedOpen} onOpenChange={setUnmappedOpen} title={`${data?.unmapped.length ?? 0} members could not be mapped`}>
        {!data || data.unmapped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everyone with a usable postcode has been mapped.</p>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto scrollbar-thin">
            {data.unmapped.map((m) => (
              <a
                key={m.id}
                href={`/gym/members/${m.id}`}
                className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-secondary/40"
              >
                <div>
                  <p className="font-medium">{m.fullName}</p>
                  <p className="text-xs text-muted-foreground">{m.memberNumber}</p>
                </div>
                <span className="text-xs text-muted-foreground">{m.reason}</span>
              </a>
            ))}
          </div>
        )}
      </EntityDialog>

      {loading && !data && <p className="text-center text-sm text-muted-foreground">Loading map…</p>}
    </div>
  );
}
