"use server";

import { revalidatePath } from "next/cache";
import { requireGymUser, assertPermission } from "@/lib/gym/auth";
import { getGeocodingProvider } from "@/lib/gym/geocoding";
import { geocodeMembersBatch } from "@/lib/gym/member-geocoding";
import { logAudit } from "@/lib/gym/audit";

/** Location search box on the Member Map ("SL6", "Maidenhead", "Reading"…)
 * — flies the map to the result rather than filtering member data. */
export async function searchMapLocationAction(query: string) {
  await requireGymUser();
  const trimmed = query.trim();
  if (!trimmed) return null;

  const provider = getGeocodingProvider();
  if (!provider) throw new Error("Map search isn't available yet — Mapbox isn't configured.");

  return provider.searchPlace(trimmed);
}

/** "Retry geocoding" button for members currently missing a map location
 * (never attempted, or a prior attempt failed) — bounded to a permission
 * gate since it makes real geocoding API calls. */
export async function retryGeocodingAction() {
  const user = await assertPermission("manageMemberships");

  const result = await geocodeMembersBatch();

  await logAudit({
    userId: user.id,
    action: "MEMBER_GEOCODE_RETRY",
    entityType: "GymMember",
    metadata: result,
  });
  revalidatePath("/gym/members");
  return result;
}
