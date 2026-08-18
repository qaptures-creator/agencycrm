import "server-only";
import { prisma } from "@/lib/prisma";
import { getGeocodingProvider } from "@/lib/gym/geocoding";

/**
 * Turns a member's free-text `address` into an approximate, privacy-safe
 * map point: extract the postcode only (never the house number/street —
 * so nothing more precise than a postcode is ever sent to the geocoder),
 * resolve it to a centroid, nudge that centroid by a small deterministic
 * offset per member, and cache the result on GymMember so the map never
 * re-geocodes on every page load.
 */

const UK_POSTCODE_RE =
  /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;

export function extractUkPostcode(address: string): string | null {
  const match = address.match(UK_POSTCODE_RE);
  if (!match) return null;
  return normalizePostcode(match[0]);
}

export function normalizePostcode(raw: string): string {
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  // UK postcodes always end in a 3-character "inward code" (digit + 2 letters).
  const outward = compact.slice(0, -3);
  const inward = compact.slice(-3);
  return `${outward} ${inward}`;
}

export function postcodeArea(postcode: string): string {
  return postcode.match(/^[A-Z]{1,2}/)?.[0] ?? "";
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Small FNV-1a hash — deterministic, no crypto needed, just needs to spread
// member IDs evenly so jitter direction/distance looks random per member
// but is stable across re-geocodes of the same member.
function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const MAX_JITTER_METERS = 150;

/** Nudges a postcode centroid by up to ~150m in a deterministic
 * member-specific direction, so the stored point is never the exact
 * postcode centroid — an extra privacy margin on top of postcode-level
 * (not house-level) precision. */
export function jitterCoordinate(latitude: number, longitude: number, seed: string): { latitude: number; longitude: number } {
  const h1 = stableHash(seed);
  const h2 = stableHash(`${seed}:2`);
  const angle = (h1 % 3600) / 3600 * 2 * Math.PI;
  const distanceMeters = (h2 % 1000) / 1000 * MAX_JITTER_METERS;

  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = 111_320 * Math.cos((latitude * Math.PI) / 180);

  return {
    latitude: latitude + (Math.sin(angle) * distanceMeters) / metersPerDegreeLat,
    longitude: longitude + (Math.cos(angle) * distanceMeters) / (metersPerDegreeLon || 1),
  };
}

async function getGymLocation(): Promise<{ latitude: number; longitude: number } | null> {
  const settings = await prisma.gymSettings.findUnique({ where: { id: "singleton" } });
  if (settings?.latitude == null || settings?.longitude == null) return null;
  return { latitude: settings.latitude, longitude: settings.longitude };
}

type GeocodeOutcome = "OK" | "FAILED" | "NO_POSTCODE";

/** Geocodes a single member. Best-effort: never throws — a failure is
 * recorded as geocodeStatus and the caller (member save, batch backfill)
 * carries on regardless. */
export async function geocodeMember(memberId: string): Promise<GeocodeOutcome> {
  const member = await prisma.gymMember.findUnique({ where: { id: memberId }, select: { id: true, address: true } });
  if (!member) return "FAILED";

  const postcode = member.address ? extractUkPostcode(member.address) : null;
  if (!postcode) {
    await prisma.gymMember.update({
      where: { id: memberId },
      data: { postcode: null, geocodeStatus: "NO_POSTCODE", geocodedAt: new Date(), latitude: null, longitude: null, placeName: null, distanceMiles: null },
    });
    return "NO_POSTCODE";
  }

  const provider = getGeocodingProvider();
  if (!provider) return "FAILED"; // not configured yet — leave existing status untouched by caller

  try {
    const result = await provider.geocodePostcode(postcode);
    if (!result) {
      await prisma.gymMember.update({
        where: { id: memberId },
        data: { postcode, geocodeStatus: "FAILED", geocodedAt: new Date() },
      });
      return "FAILED";
    }

    const jittered = jitterCoordinate(result.latitude, result.longitude, memberId);
    const gym = await getGymLocation();
    const distanceMiles = gym ? haversineMiles(jittered.latitude, jittered.longitude, gym.latitude, gym.longitude) : null;

    await prisma.gymMember.update({
      where: { id: memberId },
      data: {
        postcode,
        placeName: result.placeName,
        latitude: jittered.latitude,
        longitude: jittered.longitude,
        distanceMiles,
        geocodeStatus: "OK",
        geocodedAt: new Date(),
      },
    });
    return "OK";
  } catch {
    await prisma.gymMember.update({
      where: { id: memberId },
      data: { postcode, geocodeStatus: "FAILED", geocodedAt: new Date() },
    });
    return "FAILED";
  }
}

/** Recomputes distanceMiles for every already-geocoded member from their
 * cached lat/lng — cheap (no geocoding calls), used after the gym's own
 * location changes. */
export async function recomputeAllMemberDistances(): Promise<number> {
  const gym = await getGymLocation();
  if (!gym) return 0;

  const members = await prisma.gymMember.findMany({
    where: { geocodeStatus: "OK", latitude: { not: null }, longitude: { not: null } },
    select: { id: true, latitude: true, longitude: true },
  });

  for (const m of members) {
    const distanceMiles = haversineMiles(m.latitude!, m.longitude!, gym.latitude, gym.longitude);
    await prisma.gymMember.update({ where: { id: m.id }, data: { distanceMiles } });
  }
  return members.length;
}

/** Geocodes the gym's own address (Settings → gym address) into
 * GymSettings.latitude/longitude, then recomputes every member's cached
 * distance from the new location. The gym's own point is NOT jittered —
 * it's a business address, not a member's home. */
export async function geocodeGymLocation(): Promise<{ ok: boolean; error?: string }> {
  const settings = await prisma.gymSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.address) return { ok: false, error: "No gym address set" };

  const postcode = extractUkPostcode(settings.address);
  if (!postcode) return { ok: false, error: "Could not find a UK postcode in the gym address" };

  const provider = getGeocodingProvider();
  if (!provider) return { ok: false, error: "Geocoding is not configured (MAPBOX_ACCESS_TOKEN missing)" };

  try {
    const result = await provider.geocodePostcode(postcode);
    if (!result) return { ok: false, error: `Postcode "${postcode}" could not be resolved` };

    await prisma.gymSettings.update({
      where: { id: "singleton" },
      data: { latitude: result.latitude, longitude: result.longitude },
    });
    await recomputeAllMemberDistances();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

const BATCH_CONCURRENCY = 5;
const BATCH_DELAY_MS = 150; // stay well under Mapbox's rate limits

/** Geocodes many members with limited concurrency. Used for the one-off
 * historical backfill and for an on-demand "retry failed" sweep. Safe to
 * re-run — `force: false` (default) skips members already geocodeStatus
 * "OK". Updates GymGeocodeSyncState as it goes so progress is visible. */
export async function geocodeMembersBatch(options?: { memberIds?: string[]; force?: boolean }): Promise<{ candidates: number; ok: number; failed: number; noPostcode: number }> {
  if (!getGeocodingProvider()) {
    throw new Error("Geocoding is not configured — set MAPBOX_ACCESS_TOKEN before running a batch geocode.");
  }

  const where = options?.memberIds
    ? { id: { in: options.memberIds } }
    : options?.force
      ? {}
      // `{ not: "OK" }` alone excludes NULL rows under SQL's three-valued
      // logic (NULL != 'OK' isn't TRUE) — every never-attempted member has
      // a NULL geocodeStatus, so this must be spelled out explicitly.
      : { OR: [{ geocodeStatus: null }, { geocodeStatus: { not: "OK" } }] };

  const candidates = await prisma.gymMember.findMany({ where, select: { id: true } });

  await prisma.gymGeocodeSyncState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastRunAt: new Date(), lastRunStatus: "RUNNING", totalCandidates: candidates.length, geocodedCount: 0, failedCount: 0 },
    update: { lastRunAt: new Date(), lastRunStatus: "RUNNING", lastRunError: null, totalCandidates: candidates.length, geocodedCount: 0, failedCount: 0 },
  });

  let ok = 0;
  let failed = 0;
  let noPostcode = 0;

  try {
    for (let i = 0; i < candidates.length; i += BATCH_CONCURRENCY) {
      const chunk = candidates.slice(i, i + BATCH_CONCURRENCY);
      const outcomes = await Promise.all(chunk.map((c) => geocodeMember(c.id)));
      for (const outcome of outcomes) {
        if (outcome === "OK") ok++;
        else if (outcome === "NO_POSTCODE") noPostcode++;
        else failed++;
      }
      await prisma.gymGeocodeSyncState.update({ where: { id: "singleton" }, data: { geocodedCount: ok, failedCount: failed } });
      if (i + BATCH_CONCURRENCY < candidates.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }

    await prisma.gymGeocodeSyncState.update({ where: { id: "singleton" }, data: { lastRunStatus: "OK", geocodedCount: ok, failedCount: failed } });
  } catch (err) {
    await prisma.gymGeocodeSyncState.update({
      where: { id: "singleton" },
      data: { lastRunStatus: "ERROR", lastRunError: err instanceof Error ? err.message : "Unknown error" },
    });
    throw err;
  }

  return { candidates: candidates.length, ok, failed, noPostcode };
}
