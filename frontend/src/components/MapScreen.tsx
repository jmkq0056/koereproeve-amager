import { useEffect, useRef, useCallback, useState } from "react";
import type { Intersection, Road, VillaStreet, Neighborhood, RouteData, MarkerFilter } from "../types";

interface Props {
  route: RouteData;
  intersections: Intersection[];
  roads: Road[];
  villaStreets: VillaStreet[];
  neighborhoods: Neighborhood[];
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

export default function MapScreen({
  route,
  intersections,
  roads,
  villaStreets,
  neighborhoods,
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

  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [showFilters, setShowFilters] = useState(false);
  const [showVillas, setShowVillas] = useState(false);
  const [outOfBounds, setOutOfBounds] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streetViewActive, setStreetViewActive] = useState(false);

  // Initialize map and draw route
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
        streetViewControl: true,
        fullscreenControl: false,
        mapTypeControl: false,
      });

      mapInstance.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();

      // Draw route
      const path = google.maps.geometry.encoding.decodePath(route.polyline);
      const routeLine = new google.maps.Polyline({
        path,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 6,
        map,
      });
      routeLineRef.current = routeLine;

      // Fit to route bounds
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      boundsRef.current = bounds;
      map.fitBounds(bounds, 60);

      // Detect out of bounds
      map.addListener("idle", () => {
        if (!boundsRef.current) return;
        const currentBounds = map.getBounds();
        if (!currentBounds) return;
        const routeCenter = boundsRef.current.getCenter();
        setOutOfBounds(!currentBounds.contains(routeCenter));
      });

      // Detect street view
      const sv = map.getStreetView();
      sv.addListener("visible_changed", () => {
        setStreetViewActive(sv.getVisible());
      });
    };

    init();

    return () => {
      markersRef.current.forEach((m) => (m.map = null));
      polylinesRef.current.forEach((p) => p.setMap(null));
      routeLineRef.current?.setMap(null);
    };
  }, []);

  // Update map type
  useEffect(() => {
    mapInstance.current?.setMapTypeId(mapType);
  }, [mapType]);

  // Draw intersection markers
  useEffect(() => {
    if (!mapInstance.current) return;
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    intersections.forEach((inter) => {
      const filterKey = inter.type as keyof MarkerFilter;
      if (filterKey in filters && !filters[filterKey]) return;

      const color = TYPE_COLORS[inter.type] || "#9ca3af";
      const label = TYPE_LABELS[inter.type] || inter.type;

      const pin = document.createElement("div");
      pin.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);`;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance.current!,
        position: { lat: inter.lat, lng: inter.lng },
        content: pin,
        title: label,
      });

      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:system-ui;font-size:13px;padding:4px">
            <strong style="color:${color}">${label}</strong>
          </div>`
        );
        infoWindowRef.current?.open(mapInstance.current!, marker);
      });

      markersRef.current.push(marker);
    });
  }, [intersections, filters]);

  // Draw speed limit overlays
  useEffect(() => {
    if (!mapInstance.current) return;
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!filters.speed_limits) return;

    roads.forEach((road) => {
      if (road.geometry.length < 2) return;
      const speed = parseInt(road.maxspeed) || 50;
      let color = "#a855f7";
      if (speed <= 30) color = "#22c55e";
      else if (speed <= 50) color = "#3b82f6";
      else if (speed <= 60) color = "#eab308";
      else if (speed <= 80) color = "#f97316";
      else color = "#ef4444";

      const polyline = new google.maps.Polyline({
        path: road.geometry,
        strokeColor: color,
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: mapInstance.current!,
      });

      polyline.addListener("click", (e: google.maps.MapMouseEvent) => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:system-ui;font-size:13px;padding:4px">
            <strong>${road.name}</strong><br/>
            <span style="color:${color};font-size:16px;font-weight:bold">${road.maxspeed} km/t</span>
          </div>`
        );
        infoWindowRef.current?.setPosition(e.latLng);
        infoWindowRef.current?.open(mapInstance.current!);
      });

      polylinesRef.current.push(polyline);
    });
  }, [roads, filters.speed_limits]);

  const resetView = useCallback(() => {
    if (mapInstance.current && boundsRef.current) {
      mapInstance.current.fitBounds(boundsRef.current, 60);
    }
  }, []);

  const exitStreetView = useCallback(() => {
    const sv = mapInstance.current?.getStreetView();
    if (sv) sv.setVisible(false);
  }, []);

  const openVillaInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/@${lat},${lng},17z`, "_blank");
  };

  const FILTER_ITEMS: { key: keyof MarkerFilter; label: string; color: string }[] = [
    { key: "hojre_vigepligt", label: "Højre vigepligt", color: "#ef4444" },
    { key: "ubetinget_vigepligt", label: "Ubetinget vigepligt", color: "#3b82f6" },
    { key: "trafiklys", label: "Trafiklys", color: "#22c55e" },
    { key: "stopskilt", label: "Stopskilt", color: "#eab308" },
    { key: "speed_limits", label: "Hastighed", color: "#a855f7" },
  ];

  return (
    <div className="h-full relative">
      {/* Map */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Street View back button */}
      {streetViewActive && (
        <button
          onClick={exitStreetView}
          className="absolute top-4 left-4 z-20 bg-black/80 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg"
        >
          ← Tilbage til kort
        </button>
      )}

      {/* Top bar - only show when NOT in street view */}
      {!streetViewActive && (
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
          {/* Back button */}
          <button
            onClick={onBack}
            className="bg-white shadow-lg rounded-xl px-3 py-2.5 text-sm font-semibold shrink-0"
          >
            ← Hjem
          </button>

          {/* Route info */}
          <div className="bg-white shadow-lg rounded-xl px-3 py-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{route.duration_minutes} min</span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-sm text-slate-600">
                {(route.distance_meters / 1000).toFixed(1)} km
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  route.duration_minutes >= 25 && route.duration_minutes <= 40
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {route.duration_minutes >= 25 && route.duration_minutes <= 40 ? "OK" : "Uden for tid"}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {route.include_motorway ? "Med motorvej (E20)" : "Uden motorvej"}
            </p>
          </div>

          {/* Save */}
          <button
            onClick={() => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            className={`shadow-lg rounded-xl px-3 py-2.5 text-sm font-semibold shrink-0 ${
              saved ? "bg-green-500 text-white" : "bg-white"
            }`}
          >
            {saved ? "Gemt!" : "Gem"}
          </button>
        </div>
      )}

      {/* Bottom controls - only show when NOT in street view */}
      {!streetViewActive && (
        <div className="absolute bottom-6 left-4 right-4 z-10 flex items-end justify-between">
          {/* Left: filter + villa buttons */}
          <div className="flex flex-col gap-2">
            {/* Villa panel */}
            {showVillas && (
              <div className="bg-white shadow-lg rounded-xl p-3 w-64 max-h-48 overflow-y-auto mb-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Villa kvarterer</h3>
                  <button onClick={() => setShowVillas(false)} className="text-slate-400 text-sm">✕</button>
                </div>
                {neighborhoods.map((n, i) => (
                  <button
                    key={i}
                    onClick={() => openVillaInMaps(n.lat, n.lng)}
                    className="w-full text-left text-xs py-1.5 border-b border-slate-100 hover:text-blue-500 flex justify-between"
                  >
                    <span>{n.name}</span>
                    <span className="text-blue-400">↗</span>
                  </button>
                ))}
                {villaStreets.slice(0, 30).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openVillaInMaps(s.lat, s.lng)}
                    className="w-full text-left text-xs py-1.5 border-b border-slate-100 hover:text-blue-500 flex justify-between"
                  >
                    <span>{s.name}</span>
                    <span className="text-blue-400">↗</span>
                  </button>
                ))}
              </div>
            )}

            {/* Filter panel */}
            {showFilters && (
              <div className="bg-white shadow-lg rounded-xl p-3 w-56 mb-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Vis på kort</h3>
                  <button onClick={() => setShowFilters(false)} className="text-slate-400 text-sm">✕</button>
                </div>
                {FILTER_ITEMS.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters[item.key]}
                      onChange={(e) => setFilters({ ...filters, [item.key]: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-xs text-slate-700">{item.label}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowFilters(!showFilters); setShowVillas(false); }}
                className="bg-white shadow-lg rounded-xl px-3 py-2.5 text-xs font-semibold"
              >
                Filter
              </button>
              <button
                onClick={() => { setShowVillas(!showVillas); setShowFilters(false); }}
                className="bg-white shadow-lg rounded-xl px-3 py-2.5 text-xs font-semibold"
              >
                Villa
              </button>
            </div>
          </div>

          {/* Right: map type + reset */}
          <div className="flex flex-col gap-2 items-end">
            {outOfBounds && (
              <button
                onClick={resetView}
                className="bg-blue-500 text-white shadow-lg rounded-xl px-3 py-2.5 text-xs font-semibold animate-pulse"
              >
                Tilbage til rute
              </button>
            )}
            <button
              onClick={() => setMapType(mapType === "roadmap" ? "hybrid" : "roadmap")}
              className="bg-white shadow-lg rounded-xl px-3 py-2.5 text-xs font-semibold"
            >
              {mapType === "roadmap" ? "Satellit" : "Kort"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
