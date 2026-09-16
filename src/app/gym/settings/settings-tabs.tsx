"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GymDetailsForm } from "./gym-details-form";
import { AuditLogPanel } from "./audit-log-panel";
import { RolePermissionsEditor } from "./role-permissions-editor";
import { STAFF_POSITIONS, TASK_CATEGORIES } from "@/lib/gym/constants";
import type { RolePermissionsUpdate } from "@/actions/gym/role-permissions";

type SettingsLike = { gymName: string; address: string | null; phone: string | null; email: string; website: string | null };
type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
  user: { name: string; email: string } | null;
};

export function SettingsTabs({
  settings,
  canEdit,
  isOwner,
  initialAuditRows,
  initialAuditHasMore,
  rolePermissions,
}: {
  settings: SettingsLike;
  canEdit: boolean;
  isOwner: boolean;
  initialAuditRows: AuditRow[];
  initialAuditHasMore: boolean;
  rolePermissions: RolePermissionsUpdate[];
}) {
  return (
    <Tabs defaultValue="details">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="details">Gym Details</TabsTrigger>
        <TabsTrigger value="membership">Membership</TabsTrigger>
        <TabsTrigger value="roles">Staff Roles</TabsTrigger>
        <TabsTrigger value="tasks">Task Categories</TabsTrigger>
        <TabsTrigger value="cleaning">Cleaning Zones</TabsTrigger>
        <TabsTrigger value="email">Email</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        {isOwner && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
      </TabsList>

      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Gym Details</CardTitle>
          </CardHeader>
          <CardContent>
            <GymDetailsForm settings={settings} canEdit={canEdit} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="membership">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Membership Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Membership plans, pricing, and billing frequencies are managed from the Memberships page, not here.
            </p>
            <Link href="/gym/memberships" className="mt-2 inline-block text-sm text-primary hover:underline">
              Manage membership plans →
            </Link>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="roles">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Staff Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {STAFF_POSITIONS.map((p) => (
                  <Badge key={p} variant="outline">{p}</Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Fixed for now, not yet user-customisable.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Access Role Permissions</CardTitle>
              <p className="text-xs text-muted-foreground">
                Which sidebar sections each access role can see and open. The Owner always has full access and isn&apos;t shown here.
              </p>
            </CardHeader>
            <CardContent>
              <RolePermissionsEditor rolePermissions={rolePermissions} isOwner={isOwner} />
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="tasks">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Task Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {TASK_CATEGORIES.map((c) => (
                <Badge key={c.value} variant="outline">{c.label}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Fixed for now, not yet user-customisable.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="cleaning">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Cleaning Zones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add, rename, reorder, or retire the zones/areas staff clean (Free Weights, Cardio, Changing Rooms, etc.) from the Cleaning page.
            </p>
            <Link href="/gym/cleaning" className="mt-2 inline-block text-sm text-primary hover:underline">
              Go to Cleaning →
            </Link>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="email">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Email Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connecting admin@musclemassacre.com so enquiries flow in automatically is managed from Integrations.
            </p>
            <Link href="/gym/integrations" className="mt-2 inline-block text-sm text-primary hover:underline">
              Go to Integrations →
            </Link>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notifications">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Notification Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              In-app notifications (task assignments, announcements, follow-up reminders, alerts) are always on for every
              active staff account. There are no per-user notification preferences to configure yet.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="integrations">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Email, Ashbourne, Website, Google Calendar and Meta connections live on their own page.
            </p>
            <Link href="/gym/integrations" className="mt-2 inline-block text-sm text-primary hover:underline">
              Go to Integrations →
            </Link>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="branding">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary" />
              <div>
                <p className="font-display text-sm font-bold tracking-tight">MUSCLE MASSACRE</p>
                <p className="text-xs text-muted-foreground">Dark / purple industrial theme, accent colour above</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Read-only for now — no theme editor in this version.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="security">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Staff accounts are created by management from a staff member&apos;s profile — there is no public sign-up.</p>
            <p>Passwords are hashed at rest and never visible to anyone after the initial temporary password is issued.</p>
            <p>Sessions expire automatically after 14 days.</p>
            {isOwner && (
              <p className="pt-1 text-primary">
                See the Audit Log tab for a full history of who changed what, and when.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {isOwner && (
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLogPanel initialRows={initialAuditRows} initialHasMore={initialAuditHasMore} />
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
