import { NextResponse } from "next/server";
import { geocodeGymLocation, geocodeMembersBatch } from "@/lib/gym/member-geocoding";

/**
 * TEMPORARY — one-time real geocoding backfill now that Mapbox is
 * configured: locates the gym, then geocodes every member who isn't
 * already OK. Safe to re-run (everything upserts/updates in place).
 * Deleted right after use.
 */
export async function POST(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const gym = await geocodeGymLocation();
  if (!gym.ok) {
    return NextResponse.json({ ok: false, stage: "gym", error: gym.error }, { status: 502 });
  }

  const members = await geocodeMembersBatch();
  return NextResponse.json({ ok: true, gym, members });
}
