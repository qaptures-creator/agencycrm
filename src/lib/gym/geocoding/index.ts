import "server-only";
import type { GeocodingProvider } from "./types";
import { MapboxGeocodingProvider } from "./mapbox-provider";

export type { GeocodeResult, GeocodingProvider } from "./types";
export { GeocodingError } from "./types";

/** Returns null (rather than throwing) when no provider is configured —
 * callers must handle "not connected" the same way the rest of this app's
 * integrations do (see src/lib/gym/integrations/*-provider.ts). */
export function getGeocodingProvider(): GeocodingProvider | null {
  if (!process.env.MAPBOX_ACCESS_TOKEN) return null;
  return new MapboxGeocodingProvider();
}
