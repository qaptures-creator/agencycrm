"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, ArrowUp, ArrowDown, ChevronsUpDown, Loader2, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { MEMBERSHIP_STATUSES } from "@/lib/gym/constants";
import { formatDate, cn } from "@/lib/utils";
import { RDP_CONVERSION_FILTERS, RDP_COUNT_FILTERS, type RdpFilters, type RdpRow, type RdpSortKey } from "@/lib/gym/returning-day-pass-shared";

const COUNT_FILTER_LABELS: Record<string, string> = { All: "All", "2": "2+", "3": "3+", "4": "4+", "5": "5+" };

function SortableHead({
  sortKey,
  label,
  filters,
  onSort,
}: {
  sortKey: RdpSortKey;
  label: string;
  filters: RdpFilters;
  onSort: (key: RdpSortKey) => void;
}) {
  const active = filters.sort === sortKey;
  const Icon = active ? (filters.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <TableHead>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSort(sortKey);
        }}
        className={cn("inline-flex items-center gap-1 transition-colors hover:text-foreground", active && "text-foreground")}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

export function ReturningDayPassList({ rows, total, filters }: { rows: RdpRow[]; total: number; filters: RdpFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [searchInput, setSearchInput] = React.useState(filters.q);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = React.useRef(true);

  function updateParams(updates: Record<string, string | null>, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("rdpPage");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ rdpQ: searchInput.trim() || null });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function handleSort(key: RdpSortKey) {
    const dir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    updateParams({ rdpSort: key, rdpDir: dir });
  }

  const pageSize = filters.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const rangeEnd = Math.min(filters.page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email or mobile…"
            className="pl-8"
          />
        </div>

        <div className="min-w-[160px]">
          <Select value={filters.conversion} onValueChange={(v) => updateParams({ rdpConversion: v === "All" ? null : v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Conversion" />
            </SelectTrigger>
            <SelectContent>
              {RDP_CONVERSION_FILTERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "All" ? "All Conversion" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <Select value={filters.minCount} onValueChange={(v) => updateParams({ rdpCount: v === "All" ? null : v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Day Pass Count" />
            </SelectTrigger>
            <SelectContent>
              {RDP_COUNT_FILTERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "All" ? "All Day Pass Counts" : `${COUNT_FILTER_LABELS[c]} Day Passes`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <Select value={filters.status ?? "ALL"} onValueChange={(v) => updateParams({ rdpStatus: v === "ALL" ? null : v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Membership Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {MEMBERSHIP_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <p className="text-sm text-muted-foreground">
        {total === 0 ? "0 returning day pass customers" : `${rangeStart}–${rangeEnd} of ${total} returning day pass customer${total === 1 ? "" : "s"}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No returning Day Pass customers match this filter"
          description="Try a different conversion status, day pass count, or search term."
        />
      ) : (
        <div className={cn("rounded-xl border border-border bg-card transition-opacity", isPending && "opacity-60")}>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="name" label="Name" filters={filters} onSort={handleSort} />
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <SortableHead sortKey="dayPassCount" label="Day Pass Visits / Purchases" filters={filters} onSort={handleSort} />
                <TableHead>Converted to Membership?</TableHead>
                <TableHead>Current / Other Membership</TableHead>
                <TableHead>Membership Status</TableHead>
                <SortableHead sortKey="membershipStartDate" label="Membership Start Date" filters={filters} onSort={handleSort} />
                <SortableHead sortKey="firstDayPass" label="First Day Pass" filters={filters} onSort={handleSort} />
                <SortableHead sortKey="lastActivity" label="Last Activity" filters={filters} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.identityKey}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <PersonAvatar name={r.fullName} />
                      <p className="font-medium">{r.fullName}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.phone || "—"}</TableCell>
                  <TableCell className="font-medium tabular-nums">{r.dayPassCount}</TableCell>
                  <TableCell>
                    <Badge variant={r.converted ? "success" : "secondary"}>{r.converted ? "Yes" : "No"}</Badge>
                  </TableCell>
                  <TableCell>{r.otherPlanName ?? "—"}</TableCell>
                  <TableCell>{r.otherStatus ? <GymStatusBadge list={MEMBERSHIP_STATUSES} value={r.otherStatus} /> : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.otherStartDate ? formatDate(r.otherStartDate) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.firstDayPass)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.lastActivity ? formatDate(r.lastActivity) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {filters.page} of {totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={filters.page <= 1}
              onClick={() => updateParams({ rdpPage: String(filters.page - 1) }, false)}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={filters.page >= totalPages}
              onClick={() => updateParams({ rdpPage: String(filters.page + 1) }, false)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
