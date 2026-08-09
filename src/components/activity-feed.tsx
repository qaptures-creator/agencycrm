import Link from "next/link";
import { Phone, Mail, AtSign, MessageCircle, Users, FileText, Clock, StickyNote, Activity as ActivityIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PersonAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/constants";
import { formatRelativeToNow } from "@/lib/utils";
import type { Activity, User, Lead, Client } from "@prisma/client";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  EMAIL: Mail,
  INSTAGRAM_DM: AtSign,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  PROPOSAL: FileText,
  FOLLOW_UP: Clock,
  NOTE: StickyNote,
};

type ActivityWithRelations = Activity & { createdBy: User | null; lead: Lead | null; client: Client | null };

export function ActivityFeed({ activities }: { activities: ActivityWithRelations[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState icon={ActivityIcon} title="No activity yet" description="Calls, emails and notes across your leads and clients show up here." className="border-none bg-transparent py-8" />
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => {
              const Icon = ICONS[a.type as ActivityType] ?? StickyNote;
              const target = a.lead ? { name: a.lead.companyName, href: `/crm?lead=${a.lead.id}` } : a.client ? { name: a.client.companyName, href: `/clients/${a.client.id}` } : null;
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{a.subject || ACTIVITY_TYPES.find((t) => t.value === a.type)?.label}</span>
                      {target && (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={target.href} className="text-primary hover:underline">
                            {target.name}
                          </Link>
                        </>
                      )}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatRelativeToNow(a.createdAt)}</span>
                      {a.createdBy && (
                        <span className="flex items-center gap-1">
                          <PersonAvatar name={a.createdBy.name} color={a.createdBy.color} className="size-4" />
                          {a.createdBy.name}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
