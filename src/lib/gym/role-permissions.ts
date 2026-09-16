import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { GymAccessRole } from "@/lib/gym/permissions";
import { ALL_TAB_HREFS, EDITABLE_ROLES, DEFAULT_ROLE_PERMISSIONS, type EditableRole } from "@/lib/gym/role-permissions-defaults";
import { logAudit } from "@/lib/gym/audit";

function isEditableRole(role: string): role is EditableRole {
  return (EDITABLE_ROLES as string[]).includes(role);
}

/** One DB round trip per request no matter how many times it's called
 * (sidebar + topbar + the page itself all need this) — React's cache()
 * dedupes within a single render pass. */
const getRolePermissionRows = cache(async () => {
  return prisma.gymRolePermission.findMany();
});

/** Every href a given role may reach. OWNER always gets everything — that's
 * not stored in the DB, it's a hardcoded bypass, matching how permissions.ts
 * treats OWNER. A non-Owner role with no saved row yet (seed hasn't run, or
 * a role name that predates this table) fails closed — no tabs — rather
 * than silently granting access. */
export async function getAllowedTabHrefs(role: GymAccessRole | string): Promise<string[]> {
  if (role === "OWNER") return [...ALL_TAB_HREFS];
  if (!isEditableRole(role)) return [];

  const rows = await getRolePermissionRows();
  const row = rows.find((r) => r.role === role);
  if (!row) {
    console.error(`role-permissions: no GymRolePermission row for role=${role} — denying all tabs. Has the seed run?`);
    return [];
  }
  return row.allowedTabs;
}

export async function isTabAllowed(role: GymAccessRole | string, href: string): Promise<boolean> {
  const allowed = await getAllowedTabHrefs(role);
  return allowed.includes(href);
}

export type RolePermissionsMatrix = { role: EditableRole; allowedTabs: string[] }[];

/** Powers the Settings → Staff Roles editor. Always returns one row per
 * editable role, in a stable order, falling back to the shipped defaults
 * for any role missing its DB row (same fail-closed-in-code, but the UI
 * shows the intended defaults rather than an empty grid). */
export async function getRolePermissionsMatrix(): Promise<RolePermissionsMatrix> {
  const rows = await getRolePermissionRows();
  return EDITABLE_ROLES.map((role) => {
    const row = rows.find((r) => r.role === role);
    return { role, allowedTabs: row?.allowedTabs ?? DEFAULT_ROLE_PERMISSIONS[role] };
  });
}

/** Owner-only mutation — the caller (the server action) is responsible for
 * verifying the acting user is actually OWNER before calling this; this
 * function does not re-check, since it has no access to the request's
 * session. Every href is validated against the known tab list so a bad
 * client payload can't smuggle an arbitrary string into the column. */
export async function setRolePermissions(updates: { role: EditableRole; allowedTabs: string[] }[], actorUserId: string): Promise<void> {
  const validTabs = new Set<string>(ALL_TAB_HREFS);

  for (const update of updates) {
    if (!isEditableRole(update.role)) throw new Error(`Cannot set permissions for role ${update.role}`);
    const allowedTabs = update.allowedTabs.filter((href) => validTabs.has(href));

    await prisma.gymRolePermission.upsert({
      where: { role: update.role },
      create: { role: update.role, allowedTabs },
      update: { allowedTabs },
    });
  }

  await logAudit({
    userId: actorUserId,
    action: "ROLE_PERMISSIONS_UPDATED",
    entityType: "GymRolePermission",
    metadata: { roles: updates.map((u) => u.role) },
  });
}
