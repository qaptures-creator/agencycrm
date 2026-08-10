"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/avatar";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { MEMBERSHIP_STATUSES, PAYMENT_STATUSES } from "@/lib/gym/constants";
import { MemberForm } from "./member-form";
import { formatDate, cn } from "@/lib/utils";

export type MemberRow = {
  id: string;
  memberNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinDate: string;
  lastVisitAt: string | null;
  membership: {
    planName: string;
    status: string;
    paymentStatus: string;
    renewalDate: string | null;
  } | null;
};

const TABS = [
  "All",
  "Active",
  "Cancelled",
  "Frozen",
  "Expired",
  "Payment Due",
  "Failed Payment",
  "New This Month",
] as const;
type Tab = (typeof TABS)[number];

export function MemberList({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>("All");
  const [query, setQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(() => {
    const p = searchParams.get("new");
    return p === "1" || p === "note";
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtered = members.filter((m) => {
    if (tab === "Active" && m.membership?.status !== "ACTIVE") return false;
    if (tab === "Cancelled" && m.membership?.status !== "CANCELLED") return false;
    if (tab === "Frozen" && m.membership?.status !== "FROZEN") return false;
    if (tab === "Expired" && m.membership?.status !== "EXPIRED") return false;
    if (tab === "Payment Due" && m.membership?.paymentStatus !== "OVERDUE") return false;
    if (tab === "Failed Payment" && m.membership?.paymentStatus !== "FAILED") return false;
    if (tab === "New This Month" && new Date(m.joinDate) < monthStart) return false;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const haystack = [m.fullName, m.email, m.phone, m.memberNumber].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Add Member
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone or member number…"
          className="pl-8"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} member{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={members.length === 0 ? "No members yet" : "No members match this filter"}
          description={
            members.length === 0
              ? "Members are added here manually until Ashbourne is connected. Add your first member to get started."
              : "Try a different tab or search term."
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Membership Type</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Next Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
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
