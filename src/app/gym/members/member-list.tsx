"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus, Users, Search, ArrowUp, ArrowDown, ChevronsUpDown, Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/avatar";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { MEMBERSHIP_STATUSES, PAYMENT_STATUSES } from "@/lib/gym/constants";
import { MemberForm } from "./member-form";
import { ImportSalesReportDialog } from "./import-sales-report-dialog";
import { formatDate, cn } from "@/lib/utils";
import { MEMBER_STATUS_TABS, type MemberListFilters, type MemberRow, type MemberSortKey } from "@/lib/gym/member-filters-shared";

const SORT_LABELS: Record<MemberSortKey, string> = {
  name: "Member",
  type: "Membership Type",
  joinDate: "Join Date",
  nextPayment: "Next Payment",
  status: "Status",
  payment: "Payment",
  lastVisit: "Last Visit",
};

function SortableHead({
  sortKey,
  filters,
  onSort,
}: {
  sortKey: MemberSortKey;
  filters: MemberListFilters;
  onSort: (key: MemberSortKey) => void;
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
        {SORT_LABELS[sortKey]}
        <Icon className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

export function MemberList({
  members,
  total,
  filters,
  membershipTypes,
  canImport,
}: {
  members: MemberRow[];
  total: number;
  filters: MemberListFilters;
  membershipTypes: string[];
  canImport: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  // Local, immediately-responsive copy of the search box — debounced before
  // it becomes a URL param / server query, so typing doesn't issue a
  // database request on every keystroke.
  const [searchInput, setSearchInput] = React.useState(filters.q);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = React.useRef(true);

  const [dialogOpen, setDialogOpen] = React.useState(() => {
    const p = searchParams.get("new");
    return p === "1" || p === "note";
  });

  function updateParams(updates: Record<string, string | null>, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // Debounced search — ~300ms after the user stops typing, push `q` to the
  // URL (which re-runs the server query). Skipped on first render so
  // loading the page doesn't immediately re-navigate to its own URL.
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ q: searchInput.trim() || null });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Export always reflects the CURRENT filters/search/sort — page/pageSize
  // deliberately excluded, since the export covers every matching record,
  // not just the page on screen (server-side via getAllFilteredMembers,
  // the same filter logic as the page query, not a client-side dump of
  // the rows currently rendered).
  const exportParams = new URLSearchParams();
  if (filters.status !== "All") exportParams.set("status", filters.status);
  if (filters.type) exportParams.set("type", filters.type);
  if (filters.q) exportParams.set("q", filters.q);
  exportParams.set("sort", filters.sort);
  exportParams.set("dir", filters.dir);
  const exportUrl = `/api/gym/members/export?${exportParams.toString()}`;

  function handleSort(key: MemberSortKey) {
    const dir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    updateParams({ sort: key, dir });
  }

  const pageSize = filters.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const rangeEnd = Math.min(filters.page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {MEMBER_STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => updateParams({ status: t === "All" ? null : t })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filters.status === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={exportUrl} download>
              <Download className="size-4" />
              Export CSV
            </a>
          </Button>
          {canImport && <ImportSalesReportDialog />}
          <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Add Member
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone or member number…"
            className="pl-8"
          />
        </div>

        <div className="min-w-[180px]">
          <Select value={filters.type ?? "ALL"} onValueChange={(v) => updateParams({ type: v === "ALL" ? null : v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Membership Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All membership types</SelectItem>
              {membershipTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <p className="text-sm text-muted-foreground">
        {total === 0 ? "0 members" : `${rangeStart}–${rangeEnd} of ${total} member${total === 1 ? "" : "s"}`}
      </p>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={total === 0 && !filters.q && filters.status === "All" && !filters.type ? "No members yet" : "No members match this filter"}
          description={
            total === 0 && !filters.q && filters.status === "All" && !filters.type
              ? "Members are added here manually until Ashbourne is connected. Add your first member to get started."
              : "Try a different tab, membership type, or search term."
          }
        />
      ) : (
        <div className={cn("rounded-xl border border-border bg-card transition-opacity", isPending && "opacity-60")}>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="name" filters={filters} onSort={handleSort} />
                <TableHead>Contact</TableHead>
                <SortableHead sortKey="type" filters={filters} onSort={handleSort} />
                <SortableHead sortKey="joinDate" filters={filters} onSort={handleSort} />
                <SortableHead sortKey="nextPayment" filters={filters} onSort={handleSort} />
                <SortableHead sortKey="status" filters={filters} onSort={handleSort} />
                <SortableHead sortKey="payment" filters={filters} onSort={handleSort} />
                <SortableHead sortKey="lastVisit" filters={filters} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => router.push(`/gym/members/${m.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <PersonAvatar name={m.fullName} />
                      <div>
                        <p className="font-medium">{m.fullName}</p>
                        <p className="text-xs text-muted-foreground">{m.memberNumber}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email || m.phone || "—"}</TableCell>
                  <TableCell>{m.membership?.planName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.joinDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.membership?.renewalDate ? formatDate(m.membership.renewalDate) : "—"}
                  </TableCell>
                  <TableCell>
                    {m.membership ? <GymStatusBadge list={MEMBERSHIP_STATUSES} value={m.membership.status} /> : "—"}
                  </TableCell>
                  <TableCell>
                    {m.membership ? <GymStatusBadge list={PAYMENT_STATUSES} value={m.membership.paymentStatus} /> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.lastVisitAt ? formatDate(m.lastVisitAt) : "—"}</TableCell>
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
              onClick={() => updateParams({ page: String(filters.page - 1) }, false)}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={filters.page >= totalPages}
              onClick={() => updateParams({ page: String(filters.page + 1) }, false)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Add Member">
        <MemberForm
          onSuccess={(member) => {
            setDialogOpen(false);
            router.push(`/gym/members/${member.id}`);
          }}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>
    </div>
  );
}
