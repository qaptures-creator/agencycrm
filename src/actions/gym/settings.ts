"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { gymSettingsSchema, type GymSettingsInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";
import { geocodeGymLocation } from "@/lib/gym/member-geocoding";

export async function updateGymSettingsAction(input: GymSettingsInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (user.accessRole !== "OWNER" && user.accessRole !== "MANAGER") {
    throw new Error("You do not have permission to update gym settings");
  }

  const data = gymSettingsSchema.parse(input);

  const existing = await prisma.gymSettings.findUnique({ where: { id: "singleton" }, select: { address: true } });
  const settings = await prisma.gymSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  if (settings.address && settings.address !== existing?.address) {
    await geocodeGymLocation().catch(() => undefined); // best-effort — Member Map surfaces failures itself
  }

  await logAudit({ userId: user.id, action: "GYM_SETTINGS_UPDATED", entityType: "GymSettings", entityId: "singleton" });
  revalidatePath("/gym/settings");
  revalidatePath("/gym/members");
  return settings;
}

/** Manual "Re-locate gym" trigger for the Member Map — lets staff retry
 * without re-saving the whole settings form (e.g. once Mapbox is first
 * configured, or after a transient geocoding failure). */
export async function relocateGymAction() {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (user.accessRole !== "OWNER" && user.accessRole !== "MANAGER") {
    throw new Error("You do not have permission to update gym settings");
  }

  const result = await geocodeGymLocation();
  if (!result.ok) throw new Error(result.error ?? "Could not locate the gym");

  await logAudit({ userId: user.id, action: "GYM_LOCATION_GEOCODED", entityType: "GymSettings", entityId: "singleton" });
  revalidatePath("/gym/members");
  revalidatePath("/gym/settings");
  return result;
}
