"use server";

import { revalidatePath } from "next/cache";
import { requireGymUser } from "@/lib/gym/auth";
import { setRolePermissions } from "@/lib/gym/role-permissions";
import { EDITABLE_ROLES, type EditableRole } from "@/lib/gym/role-permissions-defaults";

export type RolePermissionsUpdate = { role: EditableRole; allowedTabs: string[] };

/** The only entry point that can change the Staff Roles matrix. Hard
 * server-side OWNER check — never trusts a client-side `isOwner` prop,
 * since this is a real mutation reachable by anyone who can POST to a
 * server action, not just whoever the UI shows the button to. */
export async function updateRolePermissionsAction(updates: RolePermissionsUpdate[]) {
  const user = await requireGymUser();
  if (user.accessRole !== "OWNER") {
    throw new Error("Only the Owner can edit Staff Roles.");
  }

  const roles = new Set(updates.map((u) => u.role));
  if (updates.length !== EDITABLE_ROLES.length || !EDITABLE_ROLES.every((r) => roles.has(r))) {
    throw new Error("Invalid role permissions payload.");
  }

  await setRolePermissions(updates, user.id);
  revalidatePath("/gym", "layout");
}
