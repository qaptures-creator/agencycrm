import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  geocodeLocation,
  searchBusinesses,
  milesToMetres,
  haversineMiles,
  GooglePlacesConfigError,
  GooglePlacesApiError,
  BUSINESS_CATEGORIES,
  type BusinessCategoryValue,
} from "@/lib/google-places";
import { parseRadiusMiles, type BusinessResult } from "@/lib/business-finder-types";
import { findCrmMatches } from "@/actions/business-finder";
import { searchCache } from "@/lib/business-finder-cache";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(150).optional().default(""),
  location: z.string().trim().min(1, "Enter a location").max(200),
  radius: z.coerce.number().optional().default(5),
  category: z.string().optional(),
  pageToken: z.string().max(2000).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { q, location, category, pageToken } = parsed.data;
  const radiusMiles = parseRadiusMiles(parsed.data.radius);

  if (!q.trim() && !category) {
    return NextResponse.json({ error: "INVALID_REQUEST", message: "Enter a business type or choose a category." }, { status: 400 });
  }

  const categoryDef = BUSINESS_CATEGORIES.find((c) => c.value === (category as BusinessCategoryValue));
  const cacheKey = JSON.stringify({ q, location, radiusMiles, category, pageToken });
  const cached = searchCache.get(cacheKey) as { results: BusinessResult[]; nextPageToken: string | null; center: { lat: number; lng: number }; formattedAddress: string } | undefined;
  if (cached) return NextResponse.json({ ...cached, radiusMiles, cached: true });

  try {
    let center: { lat: number; lng: number };
    let formattedAddress: string;

    if (parsed.data.lat != null && parsed.data.lng != null) {
      center = { lat: parsed.data.lat, lng: parsed.data.lng };
      formattedAddress = location;
    } else {
      const geocoded = await geocodeLocation(location);
      if (!geocoded) {
        return NextResponse.json({ error: "LOCATION_NOT_FOUND", message: `Couldn't find "${location}". Try a town, postcode, or more specific area.` }, { status: 404 });
      }
      center = { lat: geocoded.lat, lng: geocoded.lng };
      formattedAddress = geocoded.formattedAddress;
    }

    const textQuery = q.trim() || categoryDef?.queryHint || "businesses";

    const { results: rawResults, nextPageToken } = await searchBusinesses({
      query: textQuery,
      center,
      radiusMeters: milesToMetres(radiusMiles),
      includedType: categoryDef?.includedType,
      pageToken,
    });

    const businesses: BusinessResult[] = rawResults.map((r) => ({
      placeId: r.placeId,
      name: r.name,
      category: r.category,
      address: r.formattedAddress,
      lat: r.lat,
      lng: r.lng,
      distanceMiles: r.lat != null && r.lng != null ? Math.round(haversineMiles(center, { lat: r.lat, lng: r.lng }) * 10) / 10 : null,
      rating: r.rating,
      reviewCount: r.userRatingCount,
      phone: r.phone,
      website: r.websiteUri,
      googleMapsUrl: r.googleMapsUri,
      openNow: r.openNow,
      businessStatus: r.businessStatus,
      photoUrl: r.photoName ? `/api/business-finder/photo?name=${encodeURIComponent(r.photoName)}` : null,
      instagram: null,
      instagramChecked: false,
      crmMatch: null,
    }));

    const matches = await findCrmMatches(businesses.map((b) => ({ placeId: b.placeId, website: b.website, phone: b.phone, name: b.name, address: b.address })));
    for (const b of businesses) b.crmMatch = matches.get(b.placeId) ?? null;

    const payload = { results: businesses, nextPageToken, center, formattedAddress };
    searchCache.set(cacheKey, payload, SEARCH_CACHE_TTL_MS);

    return NextResponse.json({ ...payload, radiusMiles });
  } catch (err) {
    if (err instanceof GooglePlacesConfigError) {
      return NextResponse.json({ error: "GOOGLE_API_KEY_ERROR", message: "Google Maps API key is missing or invalid on the server. Check GOOGLE_MAPS_API_KEY in Railway." }, { status: 503 });
    }
    if (err instanceof GooglePlacesApiError) {
      if (err.status === 429) {
        return NextResponse.json({ error: "GOOGLE_QUOTA_EXCEEDED", message: "Google Places API quota exceeded. Try again shortly." }, { status: 429 });
      }
      return NextResponse.json({ error: "GOOGLE_API_ERROR", message: err.message }, { status: 502 });
    }
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "TIMEOUT", message: "The search timed out. Try again." }, { status: 504 });
    }
    console.error("Business Finder search failed:", err);
    return NextResponse.json({ error: "UNKNOWN", message: "Something went wrong running that search." }, { status: 500 });
  }
}
