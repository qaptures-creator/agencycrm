import "server-only";
import { prisma } from "@/lib/prisma";
import { postcodeArea } from "@/lib/gym/member-geocoding";

/**
 * Shared query + filtering layer for the Member Map: one filtered fetch
 * feeds both the map markers and the analytics above it, so a filter
 * change (status/plan/joined date) always keeps them in sync.
 */

export type GeoMapFilters = {
  status?: string; // latest membership status, e.g. "ACTIVE"
  planId?: string;
  joinedFrom?: string; // ISO date
  joinedTo?: string;
};

export type GeoMemberRow = {
  id: string;
  fullName: string;
  memberNumber: string;
  joinDate: Date;
  geocodeStatus: string | null;
  postcode: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number | null;
  status: string | null;
  planId: string | null;
  planName: string | null;
};

export async function getFilteredGeoMembers(filters: GeoMapFilters = {}): Promise<GeoMemberRow[]> {
  const members = await prisma.gymMember.findMany({
    select: {
      id: true,
      fullName: true,
      memberNumber: true,
      joinDate: true,
      geocodeStatus: true,
      postcode: true,
      placeName: true,
      latitude: true,
      longitude: true,
      distanceMiles: true,
      memberships: {
        orderBy: { startDate: "desc" },
        take: 1,
        select: { status: true, planId: true, plan: { select: { name: true } } },
      },
    },
  });

  const rows: GeoMemberRow[] = members.map((m) => {
    const membership = m.memberships[0] ?? null;
    return {
      id: m.id,
      fullName: m.fullName,
      memberNumber: m.memberNumber,
      joinDate: m.joinDate,
      geocodeStatus: m.geocodeStatus,
      postcode: m.postcode,
      placeName: m.placeName,
      latitude: m.latitude,
      longitude: m.longitude,
      distanceMiles: m.distanceMiles,
      status: membership?.status ?? null,
      planId: membership?.planId ?? null,
      planName: membership?.plan.name ?? null,
    };
  });

  return rows.filter((r) => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.planId && r.planId !== filters.planId) return false;
    if (filters.joinedFrom && r.joinDate < new Date(filters.joinedFrom)) return false;
    if (filters.joinedTo && r.joinDate > new Date(filters.joinedTo)) return false;
    return true;
  });
}

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  postcodeArea: string;
  distanceMiles: number | null;
  status: string | null;
  planName: string | null;
};

/** Only what a marker needs — no name, no address, no full postcode. */
export function toMapPoints(rows: GeoMemberRow[]): MapPoint[] {
  return rows
    .filter((r) => r.geocodeStatus === "OK" && r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id,
      latitude: r.latitude!,
      longitude: r.longitude!,
      postcodeArea: r.postcode ? postcodeArea(r.postcode) : "",
      distanceMiles: r.distanceMiles,
      status: r.status,
      planName: r.planName,
    }));
}

export type MapStats = {
  total: number;
  mapped: number;
  unmapped: number;
  avgDistanceMiles: number | null;
  within5MilesPct: number | null;
};

export function computeMapStats(rows: GeoMemberRow[]): MapStats {
  const mapped = rows.filter((r) => r.geocodeStatus === "OK" && r.latitude != null);
  const distances = mapped.map((r) => r.distanceMiles).filter((d): d is number => d != null);
  const avgDistanceMiles = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : null;
  const within5MilesPct = distances.length ? (distances.filter((d) => d <= 5).length / distances.length) * 100 : null;
  return { total: rows.length, mapped: mapped.length, unmapped: rows.length - mapped.length, avgDistanceMiles, within5MilesPct };
}

export type AreaBreakdownRow = { area: string; count: number; pct: number };

export function computeAreaBreakdown(rows: GeoMemberRow[]): AreaBreakdownRow[] {
  const mapped = rows.filter((r) => r.geocodeStatus === "OK");
  const counts = new Map<string, number>();
  for (const r of mapped) {
    const key = r.placeName || (r.postcode ? postcodeArea(r.postcode) : "Unknown");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = mapped.length;
  return [...counts.entries()]
    .map(([area, count]) => ({ area, count, pct: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

export type DistanceBuckets = { within3: number; within5: number; within10: number; over10: number };

/** Cumulative for the first three (each is a superset of the smaller
 * radius), "over10" exclusive — matches how these get talked about
 * ("members within 5 miles" vs "members 10+ miles away"). */
export function computeDistanceBuckets(rows: GeoMemberRow[]): DistanceBuckets {
  const mapped = rows.filter((r) => r.geocodeStatus === "OK" && r.distanceMiles != null);
  const buckets: DistanceBuckets = { within3: 0, within5: 0, within10: 0, over10: 0 };
  for (const r of mapped) {
    const d = r.distanceMiles!;
    if (d <= 3) buckets.within3++;
    if (d <= 5) buckets.within5++;
    if (d <= 10) buckets.within10++;
    else buckets.over10++;
  }
  return buckets;
}

export type UnmappedMemberRow = { id: string; fullName: string; memberNumber: string; reason: string };

export function getUnmappedMembers(rows: GeoMemberRow[]): UnmappedMemberRow[] {
  return rows
    .filter((r) => r.geocodeStatus !== "OK")
    .map((r) => ({
      id: r.id,
      fullName: r.fullName,
      memberNumber: r.memberNumber,
      reason:
        r.geocodeStatus === "NO_POSTCODE"
          ? "No usable postcode on file"
          : r.geocodeStatus === "FAILED"
            ? "Postcode could not be located"
            : "Not yet geocoded",
    }));
}
