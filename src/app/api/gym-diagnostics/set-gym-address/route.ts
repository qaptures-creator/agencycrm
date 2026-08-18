import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeGymLocation } from "@/lib/gym/member-geocoding";

/**
 * TEMPORARY — sets the gym's real address (given directly by the gym
 * owner) so it's ready to geocode the moment Mapbox is configured, then
 * attempts the geocode immediately in case the token is already set.
 * Deleted right after use.
 */
export async function POST(req: Request) {
  const expected = process.env.GOODTILL_DIAGNOSTIC_TOKEN;
  const provided = req.headers.get("x-diagnostic-token");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.gymSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", address: "Unit 6, Priors Way Industrial Estate, Maidenhead SL6 2GQ" },
    update: { address: "Unit 6, Priors Way Industrial Estate, Maidenhead SL6 2GQ" },
  });

  const geocodeResult = await geocodeGymLocation();
  return NextResponse.json({ ok: true, geocodeResult });
}
