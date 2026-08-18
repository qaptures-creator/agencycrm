import "server-only";
import { GeocodingError, type GeocodeResult, type GeocodingProvider } from "./types";

/**
 * Mapbox implementation, using the v5 forward geocoding endpoint
 * (api.mapbox.com/geocoding/v5/mapbox.places) — stable and well-documented.
 * Server-only: MAPBOX_ACCESS_TOKEN never reaches the browser. The separate
 * NEXT_PUBLIC_MAPBOX_TOKEN (used by the map component to render tiles) is
 * a normal public Mapbox token — that's Mapbox's own intended client-side
 * usage, not a leak of this one.
 */

const REQUEST_TIMEOUT_MS = 10_000;

type MapboxFeature = {
  place_name: string;
  center: [number, number]; // [lon, lat]
  context?: { id: string; text: string }[];
};

type MapboxResponse = {
  features?: MapboxFeature[];
  message?: string;
};

function placeNameFromContext(feature: MapboxFeature): string | null {
  const context = feature.context ?? [];
  const place = context.find((c) => c.id.startsWith("place."));
  if (place) return place.text;
  const locality = context.find((c) => c.id.startsWith("locality."));
  if (locality) return locality.text;
  return null;
}

async function mapboxFetch(query: string, params: Record<string, string>): Promise<MapboxResponse> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new GeocodingError("MAPBOX_ACCESS_TOKEN is not configured");
  }

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message += `: ${body.message}`;
      } catch {
        // ignore — body wasn't JSON
      }
      throw new GeocodingError(`Mapbox request failed: ${message}`);
    }
    return (await res.json()) as MapboxResponse;
  } catch (err) {
    if (err instanceof GeocodingError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new GeocodingError(`Mapbox request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new GeocodingError("Mapbox request failed: network error", err);
  } finally {
    clearTimeout(timeout);
  }
}

export class MapboxGeocodingProvider implements GeocodingProvider {
  async geocodePostcode(postcode: string): Promise<GeocodeResult | null> {
    const data = await mapboxFetch(postcode, { country: "gb", types: "postcode", limit: "1" });
    const feature = data.features?.[0];
    if (!feature) return null;

    const [longitude, latitude] = feature.center;
    return {
      latitude,
      longitude,
      placeName: placeNameFromContext(feature),
      normalizedPostcode: postcode.toUpperCase(),
    };
  }

  async searchPlace(query: string): Promise<{ latitude: number; longitude: number; label: string } | null> {
    const data = await mapboxFetch(query, {
      country: "gb",
      types: "postcode,place,locality,district",
      limit: "1",
    });
    const feature = data.features?.[0];
    if (!feature) return null;

    const [longitude, latitude] = feature.center;
    return { latitude, longitude, label: feature.place_name };
  }
}
