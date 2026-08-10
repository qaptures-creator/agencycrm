"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { gymSettingsSchema, type GymSettingsInput } from "@/lib/gym/validators";
import { getCurrentGymUser } from "@/lib/gym/auth";
import { logAudit } from "@/lib/gym/audit";

export async function updateGymSettingsAction(input: GymSettingsInput) {
  const user = await getCurrentGymUser();
  if (!user) throw new Error("Not authenticated");
  if (user.accessRole !== "OWNER" && user.accessRole !== "MANAGER") {
    throw new Error("You do not have permission to update gym settings");
  }

  const data = gymSettingsSchema.parse(input);

  const settings = await prisma.gymSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  await logAudit({ userId: user.id, action: "GYM_SETTINGS_UPDATED", entityType: "GymSettings", entityId: "singleton" });
  revalidatePath("/gym/settings");
  return settings;
}
