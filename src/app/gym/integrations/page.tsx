import { Mail, Landmark, Globe, Calendar, Share2, Webhook, type LucideIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/gym/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INTEGRATION_LABELS } from "@/lib/gym/constants";
import { formatDateTime } from "@/lib/utils";
import { WebsiteToggle } from "./website-toggle";

const ICONS: Record<string, LucideIcon> = {
  EMAIL: Mail,
  ASHBOURNE: Landmark,
  WEBSITE: Globe,
  GOOGLE_CALENDAR: Calendar,
  META: Share2,
};

const DESCRIPTIONS: Record<string, string> = {
  EMAIL:
    "Pulls admin@musclemassacre.com into the Enquiries inbox and sends replies from the same address. Connect Microsoft 365, Google Workspace, or IMAP credentials via environment variables — contact your developer.",
  ASHBOURNE:
    "Syncs membership and finance data (members, memberships, payments) from Ashbourne Management. The adapter architecture already exists in code at src/lib/gym/integrations/ashbourne-provider.ts, ready for real credentials once available.",
  WEBSITE:
    "Represents the musclemassacre.com contact/enquiry form feeding into this CRM. Toggling this administratively marks that the webhook has been wired up outside this app — it does not create a real connection by itself.",
  GOOGLE_CALENDAR: "Optional future integration to sync staff rota and bookings with Google Calendar.",
  META: "Optional future integration to pull Facebook and Instagram lead-ad submissions straight into the Leads pipeline.",
};

export default async function IntegrationsPage() {
  await requirePermission("manageIntegrations");

  const integrations = await prisma.gymIntegration.findMany({ orderBy: { provider: "asc" } });
  const order = ["EMAIL", "ASHBOURNE", "WEBSITE", "GOOGLE_CALENDAR", "META"];
  const sorted = [...integrations].sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          What&apos;s really connected, and what isn&apos;t. Nothing here is ever shown as connected unless it genuinely is.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sorted.map((integration) => {
          const Icon = ICONS[integration.provider] ?? Webhook;
          const connected = integration.status === "CONNECTED";
          const isEmailOrAshbourne = integration.provider === "EMAIL" || integration.provider === "ASHBOURNE";

          return (
            <Card key={integration.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {INTEGRATION_LABELS[integration.provider] ?? integration.provider}
                    </CardTitle>
                    {connected && integration.connectedAt && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Connected {formatDateTime(integration.connectedAt)}</p>
                    )}
                  </div>
                </div>
                <Badge variant={connected ? "success" : "secondary"}>{connected ? "Connected" : "Not Connected"}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{DESCRIPTIONS[integration.provider] ?? "No description available."}</p>

                {isEmailOrAshbourne && !connected && (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
                    Not connected — no provider is implemented yet, so this can&apos;t be marked connected from the UI. This
                    will only change once real credentials are wired up in code.
                  </div>
                )}

                {integration.provider === "WEBSITE" && <WebsiteToggle connected={connected} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Other / API &amp; Webhooks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Custom API access and webhook endpoints (e.g. pushing enquiries, leads, or membership events to a third-party
            system) can be set up on request. There&apos;s no dedicated webhook endpoint built yet — talk to your developer
            about what you need connected and where.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
