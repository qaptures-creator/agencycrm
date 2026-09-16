/** Pure data — no Prisma/DB import — so it can be shared by the server-only
 * DB-backed reader (role-permissions.ts) and the plain Node seed script
 * (prisma/seed.ts), same split as membership-rules.ts/membership-kpis.ts.
 *
 * ALL_TAB_HREFS must stay in sync with GYM_NAV_ITEMS in nav-config.ts (kept
 * separate rather than imported from it, since nav-config.ts pulls in
 * lucide-react icon components that the plain seed script has no reason to
 * load).
 */

export const ALL_TAB_HREFS = [
  "/gym",
  "/gym/members",
  "/gym/live-entry",
  "/gym/memberships",
  "/gym/finances",
  "/gym/payments",
  "/gym/reports",
  "/gym/enquiries",
  "/gym/leads",
  "/gym/shake-bar",
  "/gym/email",
  "/gym/communications",
  "/gym/staff",
  "/gym/rota",
  "/gym/tasks",
  "/gym/equipment",
  "/gym/maintenance",
  "/gym/cleaning",
  "/gym/incidents",
  "/gym/marketing",
  "/gym/integrations",
  "/gym/settings",
] as const;

export type EditableRole = "MANAGER" | "STAFF" | "MARKETING";

export const EDITABLE_ROLES: EditableRole[] = ["MANAGER", "STAFF", "MARKETING"];

/** Seed values — exactly reproduce what nav-config.ts's old hardcoded
 * per-item `roles` arrays granted each role, so switching this feature on
 * doesn't change anyone's access until an Owner actually edits the matrix. */
export const DEFAULT_ROLE_PERMISSIONS: Record<EditableRole, string[]> = {
  MANAGER: ALL_TAB_HREFS.filter((href) => href !== "/gym/integrations"),
  STAFF: [
    "/gym",
    "/gym/members",
    "/gym/live-entry",
    "/gym/enquiries",
    "/gym/leads",
    "/gym/shake-bar",
    "/gym/email",
    "/gym/communications",
    "/gym/rota",
    "/gym/tasks",
    "/gym/equipment",
    "/gym/maintenance",
    "/gym/cleaning",
    "/gym/incidents",
  ],
  MARKETING: [
    "/gym",
    "/gym/live-entry",
    "/gym/enquiries",
    "/gym/leads",
    "/gym/shake-bar",
    "/gym/communications",
    "/gym/rota",
    "/gym/tasks",
    "/gym/equipment",
    "/gym/maintenance",
    "/gym/cleaning",
    "/gym/incidents",
    "/gym/marketing",
  ],
};
