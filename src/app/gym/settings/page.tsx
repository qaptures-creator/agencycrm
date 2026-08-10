import { prisma } from "@/lib/prisma";
import { requireGymUser } from "@/lib/gym/auth";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsPage() {
  const user = await requireGymUser();
  const canEdit = user.accessRole === "OWNER" || user.accessRole === "MANAGER";
  const isOwner = user.accessRole === "OWNER";

  const [settingsRow, auditRows] = await Promise.all([
    prisma.gymSettings.findUnique({ where: { id: "singleton" } }),
    isOwner
      ? prisma.gymAuditLog.findMany({
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true, email: true } } },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  const settings = settingsRow ?? {
    gymName: "Muscle Massacre",
    address: null,
    phone: null,
    email: "admin@musclemassacre.com",
    website: "https://musclemassacre.com",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Gym details, roles, categories, and system information.</p>
      </div>

      <SettingsTabs
        settings={settings}
        canEdit={canEdit}
        isOwner={isOwner}
        initialAuditRows={auditRows}
        initialAuditHasMore={auditRows.length === 50}
      />
    </div>
  );
}
