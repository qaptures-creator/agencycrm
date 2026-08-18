// Server-only service layer for Google Maps Platform. Never import this
// from a Client Component — GOOGLE_MAPS_API_KEY must never reach the
// browser. Uses the current Places API ("Places API (New)") text search
// rather than the legacy Places API, plus the Geocoding API to resolve a
// free-text location into coordinates for radius search.
//
// Google Cloud APIs that must be enabled for this to work: "Places API
// (New)" and "Geocoding API". See MCP_SETUP.md-style notes in the PR
// description / chat summary for exact setup steps.

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_PHOTO_BASE = "https://places.googleapis.com/v1";

export class GooglePlacesConfigError extends Error {}
export class GooglePlacesApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new GooglePlacesConfigError("GOOGLE_MAPS_API_KEY is not configured on the server.");
  return key;
}

export type GeocodedLocation = { lat: number; lng: number; formattedAddress: string };

export async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const key = getApiKey();
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("region", "gb");
  url.searchParams.set("key", key);

  const res = await fetchWithTimeout(url.toString(), {}, 8000);
  if (!res.ok) throw new GooglePlacesApiError(`Geocoding request failed (${res.status})`, res.status);
  const data = await res.json();

  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") {
    throw new GooglePlacesApiError(data.error_message || `Geocoding API returned ${data.status}`, 502);
  }
  const result = data.results?.[0];
  if (!result) return null;
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

// Broad UI categories -> a single representative Google place type. Places
// API (New) text search only accepts one `includedType`, so this is a
// best-effort nudge, not a strict filter — the free-text query is what
// actually drives relevance, per product spec ("enhance rather than
// prevent free-text searching").
export const BUSINESS_CATEGORIES = [
  { value: "GYM_FITNESS", label: "Gym / Fitness", includedType: "gym", queryHint: "gyms" },
  { value: "RESTAURANT_FOOD", label: "Restaurant / Food", includedType: "restaurant", queryHint: "restaurants" },
  { value: "AUTOMOTIVE", label: "Automotive", includedType: "car_repair", queryHint: "car garages" },
  { value: "PROPERTY", label: "Property", includedType: "real_estate_agency", queryHint: "estate agents" },
  { value: "CONSTRUCTION", label: "Construction", includedType: "general_contractor", queryHint: "construction companies" },
  { value: "HEALTHCARE", label: "Healthcare", includedType: "dentist", queryHint: "healthcare providers" },
  { value: "BEAUTY", label: "Beauty", includedType: "beauty_salon", queryHint: "beauty salons" },
  { value: "RETAIL", label: "Retail", includedType: "store", queryHint: "shops" },
  { value: "PROFESSIONAL_SERVICES", label: "Professional Services", includedType: "lawyer", queryHint: "professional services" },
  { value: "HOSPITALITY", label: "Hospitality", includedType: "lodging", queryHint: "hotels" },
  { value: "EDUCATION", label: "Education", includedType: "school", queryHint: "schools" },
  { value: "OTHER", label: "Other", includedType: undefined, queryHint: "businesses" },
] as const;
export type BusinessCategoryValue = (typeof BUSINESS_CATEGORIES)[number]["value"];

export type GooglePlaceResult = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  phone: string | null;
  googleMapsUri: string | null;
  openNow: boolean | null;
  category: string | null;
  businessStatus: string | null;
  photoName: string | null;
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.googleMapsUri",
  "places.currentOpeningHours.openNow",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.photos",
  "nextPageToken",
].join(",");

export async function searchBusinesses(params: {
  query: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  includedType?: string;
  pageToken?: string;
}): Promise<{ results: GooglePlaceResult[]; nextPageToken: string | null }> {
  const key = getApiKey();

  const body: Record<string, unknown> = params.pageToken
    ? { pageToken: params.pageToken }
    : {
        textQuery: params.query,
        locationBias: {
          circle: {
            center: { latitude: params.center.lat, longitude: params.center.lng },
            radius: params.radiusMeters,
          },
        },
        ...(params.includedType ? { includedType: params.includedType } : {}),
        maxResultCount: 20,
      };

  const res = await fetchWithTimeout(
    PLACES_SEARCH_TEXT_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    },
    10000
  );

  if (res.status === 403 || res.status === 401) {
    throw new GooglePlacesConfigError("Google rejected the API key (invalid, restricted, or the required APIs aren't enabled).");
  }
  if (res.status === 429) {
    throw new GooglePlacesApiError("Google Places API quota exceeded.", 429);
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new GooglePlacesApiError(errBody?.error?.message || `Places API request failed (${res.status})`, res.status);
  }

  const data = await res.json();
  const places = Array.isArray(data.places) ? data.places : [];

  const results: GooglePlaceResult[] = places.map((p: Record<string, unknown>) => ({
    placeId: p.id as string,
    name: (p.displayName as { text?: string } | undefined)?.text ?? "Unknown business",
    formattedAddress: (p.formattedAddress as string) ?? null,
    lat: (p.location as { latitude?: number } | undefined)?.latitude ?? null,
    lng: (p.location as { longitude?: number } | undefined)?.longitude ?? null,
    rating: (p.rating as number) ?? null,
    userRatingCount: (p.userRatingCount as number) ?? null,
    websiteUri: (p.websiteUri as string) ?? null,
    phone: (p.nationalPhoneNumber as string) ?? (p.internationalPhoneNumber as string) ?? null,
    googleMapsUri: (p.googleMapsUri as string) ?? null,
    openNow: (p.currentOpeningHours as { openNow?: boolean } | undefined)?.openNow ?? null,
    category: (p.primaryTypeDisplayName as { text?: string } | undefined)?.text ?? null,
    businessStatus: (p.businessStatus as string) ?? null,
    photoName: Array.isArray(p.photos) && p.photos[0]?.name ? (p.photos[0].name as string) : null,
  }));

  return { results, nextPageToken: data.nextPageToken ?? null };
}

/** Server-side only: fetches photo bytes for a given photo resource name (e.g. "places/XXX/photos/YYY"). */
export async function fetchPlacePhoto(photoName: string, maxWidthPx: number): Promise<Response> {
  const key = getApiKey();
  const url = `${PLACES_PHOTO_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${encodeURIComponent(key)}`;
  return fetchWithTimeout(url, {}, 8000);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function milesToMetres(miles: number): number {
  return Math.round(miles * 1609.344);
}

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
