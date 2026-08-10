import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Inbox, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { PersonAvatar } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GymStatusBadge } from "@/components/gym/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  MEMBERSHIP_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_TX_STATUSES,
  ENQUIRY_STATUSES,
  LEAD_STAGES,
  labelFor,
} from "@/lib/gym/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { MemberEditButton } from "./member-edit-button";
import { MembershipActions } from "./membership-actions";
import { MemberNotes, type MemberNoteRow } from "./member-notes";

function moneyGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireGymUser();
  const canManage = can(user.accessRole as GymAccessRole, "manageMemberships");

  const [member, plans] = await Promise.all([
    prisma.gymMember.findUnique({
      where: { id },
      include: {
        memberships: {
          orderBy: { startDate: "desc" },
          include: { plan: true },
        },
        payments: { orderBy: { date: "desc" }, take: 20 },
        memberNotes: { orderBy: { createdAt: "desc" }, include: { author: true } },
      },
    }),
    prisma.gymMembershipPlan.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!member) notFound();

  const current =
    member.memberships.find((m) => ["ACTIVE", "FROZEN", "OVERDUE"].includes(m.status)) ?? member.memberships[0] ?? null;

  const [enquiries, leads] = member.email
    ? await Promise.all([
        prisma.gymEnquiry.findMany({ where: { email: member.email }, orderBy: { createdAt: "desc" }, take: 10 }),
        prisma.gymLead.findMany({ where: { email: member.email }, orderBy: { createdAt: "desc" }, take: 10 }),
      ])
    : [[], []];

  const notes: MemberNoteRow[] = member.memberNotes.map((n) => ({
    id: n.id,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    authorName: n.author?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar name={member.fullName} className="size-14 text-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold">{member.fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{member.memberNumber}</span>
              {current && <GymStatusBadge list={MEMBERSHIP_STATUSES} value={current.status} />}
              {current && <GymStatusBadge list={PAYMENT_STATUSES} value={current.paymentStatus} />}
            </div>
          </div>
        </div>
        <MemberEditButton member={member} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Membership Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <MembershipActions
            memberId={member.id}
            memberEmail={member.email}
            memberPhone={member.phone}
            canManage={canManage}
            current={
              current
                ? {
                    id: current.id,
                    status: current.status,
                    planId: current.planId,
                    billingAmount: current.billingAmount,
                    paymentFrequency: current.paymentFrequency,
                    renewalDate: current.renewalDate?.toISOString() ?? null,
                  }
                : null
            }
            plans={plans.map((p) => ({ id: p.id, name: p.name, price: p.price, billingFrequency: p.billingFrequency }))}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Member Number" value={member.memberNumber} />
            <DetailRow label="Email" value={member.email} />
            <DetailRow label="Phone" value={member.phone} />
            <DetailRow label="Date of Birth" value={member.dob ? formatDate(member.dob) : null} />
            <DetailRow label="Address" value={member.address} />
            <DetailRow label="Join Date" value={formatDate(member.joinDate)} />
            <DetailRow label="Emergency Contact" value={member.emergencyContactName} />
            <DetailRow label="Emergency Phone" value={member.emergencyContactPhone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {current ? (
              <>
                <DetailRow label="Plan" value={current.plan.name} />
                <DetailRow label="Start Date" value={formatDate(current.startDate)} />
                <DetailRow label="Renewal Date" value={current.renewalDate ? formatDate(current.renewalDate) : null} />
                <DetailRow label="Billing Amount" value={moneyGBP(current.billingAmount)} />
                <DetailRow label="Billing Frequency" value={current.paymentFrequency} />
                <DetailRow label="Source" value={current.source === "ASHBOURNE" ? "Ashbourne" : "Manual entry"} />
              </>
            ) : (
              <p className="text-muted-foreground">No membership on record yet. Use &quot;Add Membership&quot; above.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{member.notes || "No general notes on file."}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {member.payments.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No payments recorded"
                description="Payments logged manually or (once connected) synced from Ashbourne will appear here."
                className="border-none bg-transparent py-8"
              />
            ) : (
              <div className="divide-y divide-border/60">
                {member.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{moneyGBP(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.date)} · {p.type.replace(/_/g, " ")} · {p.provider}
                      </p>
                    </div>
                    <GymStatusBadge list={PAYMENT_TX_STATUSES} value={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Communications</CardTitle>
          </CardHeader>
          <CardContent>
            {enquiries.length === 0 && leads.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No linked enquiries or leads"
                description="Enquiries and leads matching this member's email will appear here."
                className="border-none bg-transparent py-8"
              />
            ) : (
              <div className="space-y-1">
                {enquiries.map((e) => (
                  <Link
                    key={e.id}
                    href={`/gym/enquiries?enquiry=${e.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary/40"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{e.subject || "Enquiry"}</span>
                    </span>
                    <GymStatusBadge list={ENQUIRY_STATUSES} value={e.status} />
                  </Link>
                ))}
                {leads.map((l) => (
                  <Link
                    key={l.id}
                    href={`/gym/leads?lead=${l.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary/40"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Target className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">Lead · {l.membershipInterest || "Membership interest"}</span>
                    </span>
                    <Badge variant="outline">{labelFor(LEAD_STAGES, l.stage)}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberNotes memberId={member.id} notes={notes} />
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}
