/** Provider-agnostic geocoding contract, so the Member Map isn't tightly
 * coupled to Mapbox. Swap in a different GeocodingProvider implementation
 * (Google, OS Places, etc.) without touching any calling code. */

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  /** Town/locality name from the geocoder, e.g. "Maidenhead" — used for
   * the area breakdown. Null if the provider didn't return one. */
  placeName: string | null;
  /** The postcode as the geocoder resolved it (may differ slightly in
   * formatting from what was submitted). */
  normalizedPostcode: string;
};

export class GeocodingError extends Error {
  constructor(
    message: string,
    public cause_?: unknown
  ) {
    super(message);
    this.name = "GeocodingError";
  }
}

export interface GeocodingProvider {
  /** Geocode a UK postcode only — deliberately never given a full street
   * address, so results never resolve to house-level precision. Returns
   * null (not an error) for a postcode the provider can't resolve. */
  geocodePostcode(postcode: string): Promise<GeocodeResult | null>;

  /** Free-text place search for the map's location search box ("SL6",
   * "Maidenhead", "Reading"...). Returns the best match, or null. */
  searchPlace(query: string): Promise<{ latitude: number; longitude: number; label: string } | null>;
}
