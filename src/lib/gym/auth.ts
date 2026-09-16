import "server-only";
import { redirect } from "next/navigation";
import { getGymSessionUser } from "@/lib/gym/session";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import { isTabAllowed } from "@/lib/gym/role-permissions";

/** Current logged-in gym CRM user, or null. Does not redirect. */
export async function getCurrentGymUser() {
  return getGymSessionUser();
}

/** Use in server components for pages that require a session. Redirects to
 * the gym login screen (preserving the intended destination) if unauthenticated. */
export async function requireGymUser(nextPath?: string) {
  const user = await getGymSessionUser();
  if (!user) {
    const qs = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/gym-login${qs}`);
  }
  return user;
}

/** Use in server components/actions that require a specific permission.
 * Throws (server actions) or redirects (pages) — call requirePermission from a
 * page, and assertPermission from a server action. */
export async function requirePermission(permission: Parameters<typeof can>[1]) {
  const user = await requireGymUser();
  if (!can(user.accessRole as GymAccessRole, permission)) {
    redirect("/gym?denied=1");
  }
  return user;
}

export async function assertPermission(permission: Parameters<typeof can>[1]) {
  const user = await getGymSessionUser();
  if (!user) throw new Error("Not authenticated");
  if (!can(user.accessRole as GymAccessRole, permission)) {
    throw new Error("You do not have permission to perform this action");
  }
  return user;
}

/** Use at the top of a gym page to gate the whole route by the DB-backed
 * Staff Roles matrix (Settings → Staff Roles). This is the actual
 * enforcement — the sidebar hiding a tab is a UI convenience, not a
 * security boundary, since a hidden link doesn't stop a direct URL visit.
 * Redirects to /gym/access-denied (never to /gym itself) so that unchecking
 * Dashboard for a role can't produce a redirect loop. */
export async function requireTabAccess(href: string) {
  const user = await requireGymUser();
  if (!(await isTabAllowed(user.accessRole, href))) {
    redirect("/gym/access-denied");
  }
  return user;
}
