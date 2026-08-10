"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Inbox as InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { EnquiryForm } from "./enquiry-form";
import { EnquiryDetailSheet, type EnquiryDetail } from "./enquiry-detail-sheet";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { ENQUIRY_STATUSES, ENQUIRY_CATEGORIES, labelFor } from "@/lib/gym/constants";
import { formatDateTime, cn } from "@/lib/utils";

type EnquiryRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  assignedToId: string | null;
  assignedTo: { fullName: string } | null;
  preview: string | null;
};

const TABS = ["Inbox", "Unread", "Assigned to Me", "Follow-Up", "Closed"] as const;
type Tab = (typeof TABS)[number];

export function EnquiryInbox({
  enquiries,
  staff,
  currentStaffId,
  selected,
  emailConnected,
}: {
  enquiries: EnquiryRow[];
  staff: { id: string; fullName: string }[];
  currentStaffId: string | null;
  selected: EnquiryDetail | null;
  emailConnected: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>("Inbox");
  const [dialogOpen, setDialogOpen] = React.useState(searchParams.get("new") === "1");

  const filtered = enquiries.filter((e) => {
    if (tab === "Unread") return e.status === "NEW";
    if (tab === "Assigned to Me") return currentStaffId && e.assignedToId === currentStaffId;
    if (tab === "Follow-Up") return e.status === "FOLLOW_UP";
    if (tab === "Closed") return e.status === "CLOSED";
    return e.status !== "CLOSED";
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
          New Enquiry
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={InboxIcon} title="No enquiries here" description="New enquiries will appear as they come in." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => router.push(`/gym/enquiries?enquiry=${e.id}`)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-secondary/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <Badge variant="outline" className="shrink-0">{labelFor(ENQUIRY_CATEGORIES, e.category)}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {e.subject || e.preview || e.email || e.phone || "No details"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <GymStatusBadge list={ENQUIRY_STATUSES} value={e.status} />
                <span className="text-[11px] text-muted-foreground">{formatDateTime(e.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <EntityDialog open={dialogOpen} onOpenChange={setDialogOpen} title="New Enquiry">
        <EnquiryForm
          staff={staff}
          onSuccess={() => {
            setDialogOpen(false);
            router.replace("/gym/enquiries");
          }}
          onCancel={() => setDialogOpen(false)}
        />
      </EntityDialog>

      <EnquiryDetailSheet enquiry={selected} staff={staff} emailConnected={emailConnected} />
    </div>
  );
}
