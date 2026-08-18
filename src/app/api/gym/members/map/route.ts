import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentGymUser } from "@/lib/gym/auth";
import {
  getFilteredGeoMembers,
  toMapPoints,
  computeMapStats,
  computeAreaBreakdown,
  computeDistanceBuckets,
  getUnmappedMembers,
  type GeoMapFilters,
} from "@/lib/gym/member-geo";

/**
 * Member Map data — same authentication as every other gym API route
 * (session cookie via getCurrentGymUser). Returns only what markers need:
 * no member names or addresses ever leave this endpoint (see toMapPoints
 * in member-geo.ts) — the unmapped list is the one exception, and that's
 * name + member number only (staff already have full access to those
 * records elsewhere in the CRM), never coordinates or address text.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentGymUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const filters: GeoMapFilters = {
    status: params.get("status") ?? undefined,
    planId: params.get("planId") ?? undefined,
    joinedFrom: params.get("joinedFrom") ?? undefined,
    joinedTo: params.get("joinedTo") ?? undefined,
  };

  const [rows, gymSettings, geocodeSync] = await Promise.all([
    getFilteredGeoMembers(filters),
    prisma.gymSettings.findUnique({ where: { id: "singleton" }, select: { gymName: true, latitude: true, longitude: true } }),
    prisma.gymGeocodeSyncState.findUnique({ where: { id: "singleton" } }),
  ]);

  return NextResponse.json({
    points: toMapPoints(rows),
    stats: computeMapStats(rows),
    areaBreakdown: computeAreaBreakdown(rows),
    distanceBuckets: computeDistanceBuckets(rows),
    unmapped: getUnmappedMembers(rows),
    gymLocation:
      gymSettings?.latitude != null && gymSettings?.longitude != null
        ? { name: gymSettings.gymName, latitude: gymSettings.latitude, longitude: gymSettings.longitude }
        : null,
    geocodeSync: geocodeSync
      ? { lastRunAt: geocodeSync.lastRunAt, lastRunStatus: geocodeSync.lastRunStatus, geocodedCount: geocodeSync.geocodedCount, failedCount: geocodeSync.failedCount }
      : null,
  });
}
