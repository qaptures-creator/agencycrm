import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findInstagram } from "@/lib/business-enrichment";
import { enrichCache } from "@/lib/business-finder-cache";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  website: z.string().trim().url().max(500),
});

const ENRICH_CACHE_TTL_MS = 30 * 60 * 1000;

// On-demand, one business at a time — called by the client per-card with a
// small concurrency limit rather than fired for an entire results page at
// once. Never invents an Instagram account: null means "not found".
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", message: "A valid website URL is required." }, { status: 400 });
  }
  const { website } = parsed.data;

  const cached = enrichCache.get(website);
  if (cached !== undefined) return NextResponse.json({ instagram: cached });

  try {
    const instagram = await findInstagram(website);
    enrichCache.set(website, instagram, ENRICH_CACHE_TTL_MS);
    return NextResponse.json({ instagram });
  } catch (err) {
    console.error("Instagram enrichment failed:", err);
    return NextResponse.json({ instagram: null });
  }
}
