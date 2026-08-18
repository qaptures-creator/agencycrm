"use client";

import * as React from "react";
import Map, { Source, Layer, Marker, Popup, NavigationControl, type MapRef, type MapMouseEvent } from "react-map-gl/mapbox";
import type { GeoJSONSource } from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { Dumbbell } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { MapPoint } from "@/lib/gym/member-geo";

export type FlyToTarget = { latitude: number; longitude: number; zoom?: number; nonce: number };

const SOURCE_ID = "members";
const CLUSTER_LAYER = "member-clusters";
const CLUSTER_COUNT_LAYER = "member-cluster-count";
const POINT_LAYER = "member-points";

function toFeatureCollection(points: MapPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: { id: p.id, postcodeArea: p.postcodeArea, distanceMiles: p.distanceMiles, status: p.status, planName: p.planName },
    })),
  };
}

export function MemberMapCanvas({
  points,
  gymLocation,
  flyTo,
  mapboxToken,
}: {
  points: MapPoint[];
  gymLocation: { name: string; latitude: number; longitude: number } | null;
  flyTo: FlyToTarget | null;
  mapboxToken: string | undefined;
}) {
  const mapRef = React.useRef<MapRef | null>(null);
  const [popup, setPopup] = React.useState<{ longitude: number; latitude: number; postcodeArea: string; distanceMiles: number | null } | null>(null);

  const initialCenter = gymLocation ?? { latitude: 51.52, longitude: -0.72 }; // Maidenhead-ish default until a gym location is set

  React.useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTo.longitude, flyTo.latitude], zoom: flyTo.zoom ?? 12, duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only when a new search result comes in (flyTo.nonce)
  }, [flyTo?.nonce]);

  const geojson = React.useMemo(() => toFeatureCollection(points), [points]);

  const handleClick = React.useCallback((event: MapMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;

    if (feature.layer?.id === CLUSTER_LAYER) {
      const clusterId = feature.properties?.cluster_id;
      const source = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!source || clusterId == null) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || !mapRef.current || zoom == null) return;
        const [lng, lat] = (feature.geometry as Point).coordinates;
        mapRef.current.easeTo({ center: [lng, lat], zoom, duration: 500 });
      });
      setPopup(null);
      return;
    }

    if (feature.layer?.id === POINT_LAYER) {
      const [lng, lat] = (feature.geometry as Point).coordinates;
      setPopup({
        longitude: lng,
        latitude: lat,
        postcodeArea: feature.properties?.postcodeArea ?? "",
        distanceMiles: feature.properties?.distanceMiles ?? null,
      });
    }
  }, []);

  if (!mapboxToken) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-border bg-card">
        <EmptyState
          icon={Dumbbell}
          title="Map isn't configured yet"
          description="Add NEXT_PUBLIC_MAPBOX_TOKEN to enable the Member Map."
          className="border-none bg-transparent"
        />
      </div>
    );
  }

  return (
    <div className="h-[560px] overflow-hidden rounded-xl border border-border">
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{ longitude: initialCenter.longitude, latitude: initialCenter.latitude, zoom: 10 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={[CLUSTER_LAYER, POINT_LAYER]}
        onClick={handleClick}
      >
        <NavigationControl position="top-right" />

        <Source
          id={SOURCE_ID}
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id={CLUSTER_LAYER}
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": ["step", ["get", "point_count"], "#a78bfa", 10, "#8b5cf6", 50, "#6d28d9"],
              "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#0f0a1a",
            }}
          />
          <Layer
            id={CLUSTER_COUNT_LAYER}
            type="symbol"
            filter={["has", "point_count"]}
            layout={{ "text-field": "{point_count_abbreviated}", "text-size": 12, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] }}
            paint={{ "text-color": "#ffffff" }}
          />
          <Layer
            id={POINT_LAYER}
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "#c4b5fd",
              "circle-radius": 6,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#0f0a1a",
            }}
          />
        </Source>

        {gymLocation && (
          <Marker longitude={gymLocation.longitude} latitude={gymLocation.latitude} anchor="bottom">
            <div className="flex flex-col items-center">
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg">
                <Dumbbell className="size-4 text-primary-foreground" />
              </div>
              <span className="mt-1 whitespace-nowrap rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground shadow">
                {gymLocation.name}
              </span>
            </div>
          </Marker>
        )}

        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            onClose={() => setPopup(null)}
            closeButton
            closeOnClick={false}
            anchor="bottom"
            className="[&_.mapboxgl-popup-content]:bg-popover [&_.mapboxgl-popup-content]:text-popover-foreground [&_.mapboxgl-popup-tip]:!border-t-popover"
          >
            <div className="px-1 py-0.5 text-sm">
              <p className="font-semibold">Member</p>
              {popup.postcodeArea && <p className="text-muted-foreground">{popup.postcodeArea} area</p>}
              {popup.distanceMiles != null && (
                <p className="text-muted-foreground">{popup.distanceMiles.toFixed(1)} miles from Muscle Massacre</p>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
