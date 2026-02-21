import { useEffect, useRef, useCallback, useState } from "react";
import type { Intersection, Road, VillaStreet, RouteData, MarkerFilter } from "../types";

interface Props {
  route: RouteData;
  intersections: Intersection[];
  roads: Road[];
  villaStreets: VillaStreet[];
  filters: MarkerFilter;
  setFilters: (f: MarkerFilter) => void;
  onBack: () => void;
  onSave: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  hojre_vigepligt: "#ef4444",
  ubetinget_vigepligt: "#3b82f6",
  trafiklys: "#22c55e",
  stopskilt: "#eab308",
};

const TYPE_LABELS: Record<string, string> = {
  hojre_vigepligt: "Højre vigepligt",
  ubetinget_vigepligt: "Ubetinget vigepligt",
  trafiklys: "Trafiklys",
  stopskilt: "Stopskilt",
};

// Haversine distance in meters between two points
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Check if a point is within `maxDist` meters of any point on the route
function nearRoute(
  lat: number, lng: number,
  routePts: { lat: number; lng: number }[],
  maxDist: number,
): boolean {
  for (const rp of routePts) {
    if (distM(lat, lng, rp.lat, rp.lng) < maxDist) return true;
  }
  return false;
}

export default function MapScreen({
  route,
  intersections,
  roads,
  villaStreets,
  filters,
  setFilters,
  onBack,
  onSave,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const routePointsRef = useRef<{ lat: number; lng: number }[]>([]);

  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [panel, setPanel] = useState<"none" | "filters" | "villas">("none");
  const [outOfBounds, setOutOfBounds] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streetViewActive, setStreetViewActive] = useState(false);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    const init = async () => {
      const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
      await google.maps.importLibrary("marker");

      const map = new Map(mapRef.current!, {
        center: { lat: 55.6295, lng: 12.6372 },
        zoom: 14,
        mapId: "koereproeve-map",
        mapTypeId: mapType,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        zoomControl: false,
      });
      mapInstance.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();

      // Draw route + sample route points for proximity filtering
      const path = google.maps.geometry.encoding.decodePath(route.polyline);
      routePointsRef.current = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
      routeLineRef.current = new google.maps.Polyline({
        path,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 6,
        map,
      });

      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      boundsRef.current = bounds;
      map.fitBounds(bounds, 60);

      map.addListener("idle", () => {
        if (!boundsRef.current) return;
        const cb = map.getBounds();
        if (!cb) return;
        setOutOfBounds(!cb.contains(boundsRef.current.getCenter()));
      });

      const sv = map.getStreetView();
      sv.addListener("visible_changed", () => setStreetViewActive(sv.getVisible()));
    };
    init();
    return () => {
      markersRef.current.forEach((m) => (m.map = null));
      polylinesRef.current.forEach((p) => p.setMap(null));
      routeLineRef.current?.setMap(null);
    };
  }, []);

  useEffect(() => { mapInstance.current?.setMapTypeId(mapType); }, [mapType]);

  // Markers
  useEffect(() => {
    if (!mapInstance.current) return;
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    const rPts = routePointsRef.current;
    intersections.forEach((inter) => {
      const fk = inter.type as keyof MarkerFilter;
      if (fk in filters && !filters[fk]) return;
      if (!nearRoute(inter.lat, inter.lng, rPts, 150)) return;
      const color = TYPE_COLORS[inter.type] || "#9ca3af";
      const label = TYPE_LABELS[inter.type] || inter.type;

      const pin = document.createElement("div");
      pin.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.3);`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance.current!,
        position: { lat: inter.lat, lng: inter.lng },
        content: pin,
        title: label,
      });
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font:13px system-ui;padding:2px"><strong style="color:${color}">${label}</strong></div>`
        );
        infoWindowRef.current?.open(mapInstance.current!, marker);
      });
      markersRef.current.push(marker);
    });
  }, [intersections, filters]);

  // Speed overlays
  useEffect(() => {
    if (!mapInstance.current) return;
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    if (!filters.speed_limits) return;

    const rPts2 = routePointsRef.current;
    roads.forEach((road) => {
      if (road.geometry.length < 2) return;
      // Only show roads where at least one point is within 150m of the route
      const isNear = road.geometry.some((g) => nearRoute(g.lat, g.lng, rPts2, 150));
      if (!isNear) return;
      const speed = parseInt(road.maxspeed) || 50;
      let color = "#a855f7";
      if (speed <= 30) color = "#22c55e";
      else if (speed <= 50) color = "#3b82f6";
      else if (speed <= 60) color = "#eab308";
      else if (speed <= 80) color = "#f97316";
      else color = "#ef4444";

      const pl = new google.maps.Polyline({
        path: road.geometry,
        strokeColor: color,
        strokeOpacity: 0.6,
        strokeWeight: 3,
        map: mapInstance.current!,
      });
      pl.addListener("click", (e: google.maps.MapMouseEvent) => {
        infoWindowRef.current?.setContent(
          `<div style="font:13px system-ui;padding:2px"><strong>${road.name}</strong><br/><span style="color:${color};font-size:15px;font-weight:bold">${road.maxspeed} km/t</span></div>`
        );
        infoWindowRef.current?.setPosition(e.latLng);
        infoWindowRef.current?.open(mapInstance.current!);
      });
      polylinesRef.current.push(pl);
    });
  }, [roads, filters.speed_limits]);

  const resetView = useCallback(() => {
    if (mapInstance.current && boundsRef.current)
      mapInstance.current.fitBounds(boundsRef.current, 60);
  }, []);

  const exitStreetView = useCallback(() => {
    mapInstance.current?.getStreetView().setVisible(false);
  }, []);

  const enterStreetView = useCallback(() => {
    const map = mapInstance.current;
    if (!map) return;
    const center = map.getCenter();
    if (!center) return;
    const sv = map.getStreetView();
    sv.setPosition(center);
    sv.setVisible(true);
  }, []);

  const FILTER_ITEMS: { key: keyof MarkerFilter; label: string; color: string }[] = [
    { key: "hojre_vigepligt", label: "Højre vigepligt", color: "#ef4444" },
    { key: "ubetinget_vigepligt", label: "Ubetinget vigepligt", color: "#3b82f6" },
    { key: "trafiklys", label: "Trafiklys", color: "#22c55e" },
    { key: "stopskilt", label: "Stopskilt", color: "#eab308" },
    { key: "speed_limits", label: "Hastighed", color: "#a855f7" },
  ];

  // Street view mode
  if (streetViewActive) {
    return (
      <div className="h-full relative">
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute top-0 left-0 right-0 z-20 pt-[env(safe-area-inset-top)] px-4 pb-2 bg-black/70">
          <button
            onClick={exitStreetView}
            className="mt-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg w-full"
          >
            ← Tilbage til kort
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={onBack} className="text-blue-500 font-semibold text-sm shrink-0">
            ← Hjem
          </button>
          <div className="flex-1 min-w-0 text-center">
            <span className="font-bold text-sm">{route.duration_minutes} min</span>
            <span className="text-slate-400 text-xs mx-1">·</span>
            <span className="text-sm text-slate-600">{(route.distance_meters / 1000).toFixed(1)} km</span>
            <span className={`text-xs ml-1 px-1.5 py-0.5 rounded-full ${
              route.duration_minutes >= 25 && route.duration_minutes <= 40
                ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {route.duration_minutes >= 25 && route.duration_minutes <= 40 ? "OK" : "Uden for tid"}
            </span>
          </div>
          <button
            onClick={() => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            className={`text-sm font-semibold shrink-0 px-3 py-1 rounded-lg ${
              saved ? "bg-green-500 text-white" : "text-blue-500"
            }`}
          >
            {saved ? "Gemt!" : "Gem"}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* Panels - positioned above bottom bar */}
        {panel === "filters" && (
          <div className="absolute bottom-2 left-3 right-3 z-10 bg-white rounded-xl shadow-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase text-slate-500">Vis på kort</span>
              <button onClick={() => setPanel("none")} className="text-slate-400 font-bold">✕</button>
            </div>
            {FILTER_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center gap-2 py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters[item.key]}
                  onChange={(e) => setFilters({ ...filters, [item.key]: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
        )}

        {panel === "villas" && (
          <div className="absolute bottom-2 left-3 right-3 z-10 bg-white rounded-xl shadow-lg p-3 max-h-[50vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2 sticky top-0 bg-white pb-1">
              <span className="text-xs font-bold uppercase text-slate-500">Villa kvarterer ({villaStreets.length})</span>
              <button onClick={() => setPanel("none")} className="text-slate-400 font-bold">✕</button>
            </div>
            {villaStreets.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  mapInstance.current?.panTo({ lat: s.lat, lng: s.lng });
                  mapInstance.current?.setZoom(17);
                  setPanel("none");
                }}
                className="w-full flex items-center justify-between py-2 border-b border-slate-100 text-sm hover:text-blue-500 text-left"
              >
                <span>{s.name}</span>
                <span className="text-blue-400 text-xs shrink-0">Vis</span>
              </button>
            ))}
          </div>
        )}

        {/* Reset view button */}
        {outOfBounds && (
          <button
            onClick={resetView}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg"
          >
            Tilbage til rute
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => setPanel(panel === "filters" ? "none" : "filters")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs ${
              panel === "filters" ? "text-blue-500 bg-blue-50" : "text-slate-600"
            }`}
          >
            <span className="text-lg">⚙</span>
            <span>Filter</span>
          </button>
          <button
            onClick={() => setPanel(panel === "villas" ? "none" : "villas")}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs ${
              panel === "villas" ? "text-blue-500 bg-blue-50" : "text-slate-600"
            }`}
          >
            <span className="text-lg">🏘</span>
            <span>Villa</span>
          </button>
          <button
            onClick={enterStreetView}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs text-slate-600"
          >
            <span className="text-lg">👁</span>
            <span>Gadevisning</span>
          </button>
          <button
            onClick={() => setMapType(mapType === "roadmap" ? "hybrid" : "roadmap")}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs text-slate-600"
          >
            <span className="text-lg">{mapType === "roadmap" ? "🛰" : "🗺"}</span>
            <span>{mapType === "roadmap" ? "Satellit" : "Kort"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
