import { useEffect, useRef, useCallback } from "react";
import type { Intersection, Road, MarkerFilter } from "../types";

const START = { lat: 55.6295, lng: 12.6372 };
const MAP_ID = "koereproeve-map";

interface Props {
  intersections: Intersection[];
  roads: Road[];
  filters: MarkerFilter;
  routePolyline?: string;
}

const TYPE_COLORS: Record<string, string> = {
  hojre_vigepligt: "#ef4444",
  ubetinget_vigepligt: "#3b82f6",
  trafiklys: "#22c55e",
  stopskilt: "#eab308",
  crossing: "#9ca3af",
};

const TYPE_LABELS: Record<string, string> = {
  hojre_vigepligt: "Højre vigepligt",
  ubetinget_vigepligt: "Ubetinget vigepligt",
  trafiklys: "Trafiklys",
  stopskilt: "Stopskilt",
};

export default function MapView({ intersections, roads, filters, routePolyline }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const init = async () => {
      const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;

      mapInstance.current = new Map(mapRef.current!, {
        center: START,
        zoom: 14,
        mapId: MAP_ID,
        tilt: 45,
        mapTypeId: "hybrid",
      });

      infoWindowRef.current = new google.maps.InfoWindow();
    };

    init();
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
  }, []);

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
  }, []);

  // Draw intersection markers
  useEffect(() => {
    if (!mapInstance.current) return;
    clearMarkers();

    const { AdvancedMarkerElement } = google.maps.marker;

    intersections.forEach((inter) => {
      const filterKey = inter.type as keyof MarkerFilter;
      if (filterKey in filters && !filters[filterKey]) return;

      const color = TYPE_COLORS[inter.type] || "#9ca3af";
      const label = TYPE_LABELS[inter.type] || inter.type;

      const pin = document.createElement("div");
      pin.style.width = "14px";
      pin.style.height = "14px";
      pin.style.borderRadius = "50%";
      pin.style.backgroundColor = color;
      pin.style.border = "2px solid white";
      pin.style.boxShadow = "0 1px 3px rgba(0,0,0,0.4)";

      const marker = new AdvancedMarkerElement({
        map: mapInstance.current!,
        position: { lat: inter.lat, lng: inter.lng },
        content: pin,
        title: label,
      });

      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:system-ui;font-size:13px">
            <strong>${label}</strong><br/>
            <span style="color:#666">${inter.lat.toFixed(5)}, ${inter.lng.toFixed(5)}</span>
          </div>`
        );
        infoWindowRef.current?.open(mapInstance.current!, marker);
      });

      markersRef.current.push(marker);
    });
  }, [intersections, filters, clearMarkers]);

  // Draw speed limit road overlays
  useEffect(() => {
    if (!mapInstance.current) return;
    clearPolylines();

    if (!filters.speed_limits) return;

    roads.forEach((road) => {
      if (road.geometry.length < 2) return;

      const speed = parseInt(road.maxspeed) || 50;
      let color = "#a855f7"; // default purple
      if (speed <= 30) color = "#22c55e";
      else if (speed <= 50) color = "#3b82f6";
      else if (speed <= 60) color = "#eab308";
      else if (speed <= 80) color = "#f97316";
      else color = "#ef4444";

      const polyline = new google.maps.Polyline({
        path: road.geometry,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstance.current!,
      });

      polyline.addListener("click", (e: google.maps.MapMouseEvent) => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:system-ui;font-size:13px">
            <strong>${road.name}</strong><br/>
            Hastighed: <strong>${road.maxspeed} km/t</strong>
          </div>`
        );
        infoWindowRef.current?.setPosition(e.latLng);
        infoWindowRef.current?.open(mapInstance.current!);
      });

      polylinesRef.current.push(polyline);
    });
  }, [roads, filters.speed_limits, clearPolylines]);

  // Draw route polyline
  useEffect(() => {
    if (!mapInstance.current) return;

    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }

    if (!routePolyline) return;

    const path = google.maps.geometry.encoding.decodePath(routePolyline);
    routeLineRef.current = new google.maps.Polyline({
      path,
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map: mapInstance.current!,
    });
  }, [routePolyline]);

  return <div ref={mapRef} className="w-full h-full" />;
}
