import { useEffect, useRef, useCallback, useState } from "react";
import type { Intersection, Road, VillaStreet, RouteData, MarkerFilter, Step } from "../types";

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

const TYPE_LETTERS: Record<string, string> = {
  hojre_vigepligt: "H",
  ubetinget_vigepligt: "U",
  trafiklys: "T",
  stopskilt: "S",
};

const TYPE_LABELS: Record<string, string> = {
  hojre_vigepligt: "Højre vigepligt",
  ubetinget_vigepligt: "Ubetinget vigepligt",
  trafiklys: "Trafiklys",
  stopskilt: "Stopskilt",
};

const MANEUVER_ARROWS: Record<string, string> = {
  TURN_LEFT: "↰",
  TURN_RIGHT: "↱",
  TURN_SLIGHT_LEFT: "↖",
  TURN_SLIGHT_RIGHT: "↗",
  TURN_SHARP_LEFT: "⮢",
  TURN_SHARP_RIGHT: "⮣",
  UTURN_LEFT: "⮌",
  UTURN_RIGHT: "⮎",
  STRAIGHT: "↑",
  DEPART: "●",
  ROUNDABOUT_LEFT: "↺",
  ROUNDABOUT_RIGHT: "↻",
  RAMP_LEFT: "↰",
  RAMP_RIGHT: "↱",
  MERGE: "⤚",
  FORK_LEFT: "↰",
  FORK_RIGHT: "↱",
  NAME_CHANGE: "↑",
};

// Road types that are NOT residential driving test roads — skip for speed lookup
const SKIP_ROAD_TYPES = new Set(["motorway", "motorway_link", "trunk", "trunk_link"]);

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearRoute(lat: number, lng: number, routePts: { lat: number; lng: number }[], maxDist: number): boolean {
  for (const rp of routePts) {
    if (distM(lat, lng, rp.lat, rp.lng) < maxDist) return true;
  }
  return false;
}

function nearPoint(lat: number, lng: number, pLat: number, pLng: number, maxDist: number): boolean {
  return distM(lat, lng, pLat, pLng) < maxDist;
}

function parseSteps(legs: any[]): Step[] {
  const steps: Step[] = [];
  for (const leg of legs) {
    for (const s of leg.steps || []) {
      const nav = s.navigationInstruction || {};
      const loc = s.localizedValues || {};
      const startLoc = s.startLocation?.latLng || {};
      const endLoc = s.endLocation?.latLng || {};
      steps.push({
        instruction: nav.instructions || "",
        maneuver: nav.maneuver || "STRAIGHT",
        distance_text: loc.distance?.text || "",
        duration_text: loc.staticDuration?.text || "",
        polyline: s.polyline?.encodedPolyline || "",
        startLat: startLoc.latitude || 0,
        startLng: startLoc.longitude || 0,
        endLat: endLoc.latitude || 0,
        endLng: endLoc.longitude || 0,
      });
    }
  }
  return steps;
}

function createLetterMarker(letter: string, color: string, size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${Math.round(size * 0.45)}px;color:white;font-family:system-ui;`;
  el.textContent = letter;
  return el;
}

function createSpeedSign(speed: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:28px;height:28px;border-radius:50%;background:white;border:3px solid #dc2626;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;color:#111;font-family:system-ui;`;
  el.textContent = speed;
  return el;
}

const START_LAT = 55.634464;
const START_LNG = 12.650135;

export default function MapScreen({ route, intersections, roads, villaStreets, filters, setFilters, onBack, onSave }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const speedMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const stepLineRef = useRef<google.maps.Polyline | null>(null);
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const routePointsRef = useRef<{ lat: number; lng: number }[]>([]);
  const startMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const svServiceRef = useRef<google.maps.StreetViewService | null>(null);

  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("hybrid");
  const [panel, setPanel] = useState<"none" | "filters" | "villas">("none");
  const [outOfBounds, setOutOfBounds] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streetViewActive, setStreetViewActive] = useState(false);

  const [mode, setMode] = useState<"overview" | "step">("overview");
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    setSteps(parseSteps(route.legs || []));
  }, [route]);

  // Init map — only once
  useEffect(() => {
    if (!mapRef.current) return;
    const init = async () => {
      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      await google.maps.importLibrary("marker");
      await google.maps.importLibrary("streetView");

      const map = new Map(mapRef.current!, {
        center: { lat: START_LAT, lng: START_LNG },
        zoom: 14,
        mapId: "koereproeve-map",
        mapTypeId: mapType,
        streetViewControl: true,
        streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
        fullscreenControl: false,
        mapTypeControl: false,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
      });
      mapInstance.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
      svServiceRef.current = new google.maps.StreetViewService();

      const path = google.maps.geometry.encoding.decodePath(route.polyline);
      routePointsRef.current = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));

      routeLineRef.current = new google.maps.Polyline({
        path,
        strokeColor: "#2563eb",
        strokeOpacity: 0.7,
        strokeWeight: 4,
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

      const startEl = createLetterMarker("S", "#16a34a", 32);
      startMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: START_LAT, lng: START_LNG },
        content: startEl,
        title: "Start / Slut",
      });
      startMarkerRef.current.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font:13px system-ui;padding:4px"><strong>Start / Slut</strong><br/>Vindblæs Alle 2, 2770 Kastrup</div>`
        );
        infoWindowRef.current?.open(map, startMarkerRef.current!);
      });

      // Street view visible listener
      const sv = map.getStreetView();
      sv.addListener("visible_changed", () => setStreetViewActive(sv.getVisible()));
    };
    init();
    return () => {
      markersRef.current.forEach((m) => (m.map = null));
      speedMarkersRef.current.forEach((m) => (m.map = null));
      routeLineRef.current?.setMap(null);
      stepLineRef.current?.setMap(null);
      startMarkerRef.current && (startMarkerRef.current.map = null);
    };
  }, []);

  useEffect(() => {
    mapInstance.current?.setMapTypeId(mapType);
  }, [mapType]);

  // Step mode map updates
  useEffect(() => {
    if (!mapInstance.current || steps.length === 0) return;
    stepLineRef.current?.setMap(null);

    if (mode === "overview") {
      routeLineRef.current?.setOptions({ strokeOpacity: 0.7, strokeWeight: 4 });
      routeLineRef.current?.setMap(mapInstance.current);
      if (boundsRef.current) mapInstance.current.fitBounds(boundsRef.current, 60);
    } else {
      routeLineRef.current?.setOptions({ strokeOpacity: 0.2, strokeWeight: 3 });
      const step = steps[currentStep];
      if (step?.polyline) {
        const stepPath = google.maps.geometry.encoding.decodePath(step.polyline);
        stepLineRef.current = new google.maps.Polyline({
          path: stepPath,
          strokeColor: "#2563eb",
          strokeOpacity: 1,
          strokeWeight: 6,
          map: mapInstance.current,
        });
        // Always center on step start at a fixed ~250m view zoom
        mapInstance.current.panTo({ lat: step.startLat, lng: step.startLng });
        mapInstance.current.setZoom(17);
      } else if (step) {
        mapInstance.current.panTo({ lat: step.startLat, lng: step.startLng });
        mapInstance.current.setZoom(17);
      }
    }
  }, [mode, currentStep, steps]);

  // Intersection markers — show ALL, no filtering by proximity
  useEffect(() => {
    if (!mapInstance.current) return;
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    intersections.forEach((inter) => {
      const fk = inter.type as keyof MarkerFilter;
      if (fk in filters && !filters[fk]) return;

      const color = TYPE_COLORS[inter.type] || "#9ca3af";
      const letter = TYPE_LETTERS[inter.type] || "?";
      const label = TYPE_LABELS[inter.type] || inter.type;

      const pin = createLetterMarker(letter, color, 24);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance.current!,
        position: { lat: inter.lat, lng: inter.lng },
        content: pin,
        title: label,
      });
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font:13px system-ui;padding:4px"><strong style="color:${color}">${label}</strong></div>`
        );
        infoWindowRef.current?.open(mapInstance.current!, marker);
      });
      markersRef.current.push(marker);
    });
  }, [intersections, filters]);

  // Speed signs — skip motorway/trunk roads
  useEffect(() => {
    if (!mapInstance.current) return;
    speedMarkersRef.current.forEach((m) => (m.map = null));
    speedMarkersRef.current = [];
    if (!filters.speed_limits) return;

    const rPts = routePointsRef.current;
    roads.forEach((road) => {
      if (road.geometry.length < 2) return;
      if (SKIP_ROAD_TYPES.has(road.highway_type)) return;
      const isNear = road.geometry.some((g) => nearRoute(g.lat, g.lng, rPts, 150));
      if (!isNear) return;

      const midIdx = Math.floor(road.geometry.length / 2);
      const midPt = road.geometry[midIdx];
      const sign = createSpeedSign(road.maxspeed);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance.current!,
        position: { lat: midPt.lat, lng: midPt.lng },
        content: sign,
        title: `${road.name} — ${road.maxspeed} km/t`,
      });
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font:13px system-ui;padding:4px"><strong>${road.name}</strong><br/>${road.maxspeed} km/t</div>`
        );
        infoWindowRef.current?.open(mapInstance.current!, marker);
      });
      speedMarkersRef.current.push(marker);
    });
  }, [roads, filters.speed_limits]);

  const resetView = useCallback(() => {
    if (mapInstance.current && boundsRef.current) mapInstance.current.fitBounds(boundsRef.current, 60);
  }, []);

  const exitStreetView = useCallback(() => {
    mapInstance.current?.getStreetView().setVisible(false);
  }, []);

  const openStreetViewAtStep = useCallback(() => {
    const map = mapInstance.current;
    const svService = svServiceRef.current;
    if (!map || !svService) return;

    let targetLat = START_LAT;
    let targetLng = START_LNG;
    if (mode === "step" && steps[currentStep]) {
      targetLat = steps[currentStep].startLat;
      targetLng = steps[currentStep].startLng;
    } else {
      const center = map.getCenter();
      if (center) {
        targetLat = center.lat();
        targetLng = center.lng();
      }
    }

    svService.getPanorama(
      {
        location: { lat: targetLat, lng: targetLng },
        radius: 300,
        preference: google.maps.StreetViewPreference.NEAREST,
        source: google.maps.StreetViewSource.OUTDOOR,
      },
      (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
          const sv = map.getStreetView();
          sv.setPosition(data.location.latLng);
          sv.setPov({ heading: 0, pitch: 0 });
          sv.setVisible(true);
        } else {
          // Fallback: start point
          svService.getPanorama(
            {
              location: { lat: START_LAT, lng: START_LNG },
              radius: 500,
              preference: google.maps.StreetViewPreference.NEAREST,
              source: google.maps.StreetViewSource.OUTDOOR,
            },
            (data2, status2) => {
              if (status2 === google.maps.StreetViewStatus.OK && data2?.location?.latLng) {
                const sv = map.getStreetView();
                sv.setPosition(data2.location.latLng);
                sv.setPov({ heading: 0, pitch: 0 });
                sv.setVisible(true);
              } else {
                alert("Ingen gadevisning tilgængelig her");
              }
            }
          );
        }
      }
    );
  }, [mode, currentStep, steps]);

  const enterStepMode = useCallback(() => {
    setCurrentStep(0);
    setMode("step");
    setPanel("none");
  }, []);

  const exitStepMode = useCallback(() => {
    setMode("overview");
  }, []);

  const goNextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const goPrevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Nearby intersections for current step — deduplicated by type, show count
  const getStepWarnings = useCallback((): { type: string; count: number }[] => {
    if (mode !== "step" || !steps[currentStep]) return [];
    const step = steps[currentStep];
    const nearby = intersections.filter(
      (i) => nearPoint(i.lat, i.lng, step.startLat, step.startLng, 40) ||
             nearPoint(i.lat, i.lng, step.endLat, step.endLng, 40)
    );
    // Deduplicate: group by type, show count
    const counts: Record<string, number> = {};
    for (const n of nearby) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  }, [mode, currentStep, steps, intersections]);

  const getVillaForStep = useCallback(() => {
    if (mode !== "step" || !steps[currentStep]) return null;
    const step = steps[currentStep];
    return villaStreets.find(
      (v) => nearPoint(v.lat, v.lng, step.startLat, step.startLng, 200) ||
             nearPoint(v.lat, v.lng, step.endLat, step.endLng, 200)
    );
  }, [mode, currentStep, steps, villaStreets]);

  // Speed for step — skip motorway/trunk roads
  const getSpeedForStep = useCallback((): string | null => {
    if (mode !== "step" || !steps[currentStep]) return null;
    const step = steps[currentStep];
    for (const road of roads) {
      if (SKIP_ROAD_TYPES.has(road.highway_type)) continue;
      if (road.geometry.some((g) => nearPoint(g.lat, g.lng, step.startLat, step.startLng, 60))) {
        return road.maxspeed;
      }
    }
    return null;
  }, [mode, currentStep, steps, roads]);

  const FILTER_ITEMS: { key: keyof MarkerFilter; label: string; color: string }[] = [
    { key: "hojre_vigepligt", label: "Højre vigepligt", color: "#ef4444" },
    { key: "ubetinget_vigepligt", label: "Ubetinget vigepligt", color: "#3b82f6" },
    { key: "trafiklys", label: "Trafiklys", color: "#22c55e" },
    { key: "stopskilt", label: "Stopskilt", color: "#eab308" },
    { key: "speed_limits", label: "Hastighed", color: "#a855f7" },
  ];

  const stepData = steps[currentStep];
  const stepWarnings = getStepWarnings();
  const villaArea = getVillaForStep();
  const speedLimit = getSpeedForStep();

  // SINGLE DOM structure — never change tree shape. Hide/show with CSS to keep map alive.
  return (
    <div className="h-full relative flex flex-col">
      {/* Top bar — hidden during street view */}
      <div className={`bg-white border-b border-slate-200 pt-[env(safe-area-inset-top)] ${streetViewActive ? "hidden" : ""}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={onBack} className="text-blue-500 font-semibold text-sm shrink-0">
            ← Hjem
          </button>
          <div className="flex-1 min-w-0 text-center">
            <span className="font-bold text-sm">{route.duration_minutes} min</span>
            <span className="text-slate-400 text-xs mx-1">·</span>
            <span className="text-sm text-slate-600">{(route.distance_meters / 1000).toFixed(1)} km</span>
            <span
              className={`text-xs ml-1 px-1.5 py-0.5 rounded-full ${
                route.duration_minutes >= 25 && route.duration_minutes <= 40
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {route.duration_minutes >= 25 && route.duration_minutes <= 40 ? "OK" : "Uden for tid"}
            </span>
          </div>
          <button
            onClick={() => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            className={`text-sm font-semibold shrink-0 px-3 py-1 rounded-lg ${saved ? "bg-green-500 text-white" : "text-blue-500"}`}
          >
            {saved ? "Gemt!" : "Gem"}
          </button>
        </div>

        {mode === "step" && steps.length > 0 && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2">
              <button onClick={exitStepMode} className="text-xs text-blue-500 font-semibold shrink-0">Oversigt</button>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500 shrink-0">Trin {currentStep + 1} af {steps.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Map — ALWAYS rendered, never removed from DOM */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* Street view exit button — overlaid on top of map */}
        {streetViewActive && (
          <div className="absolute top-0 left-0 right-0 z-20 pt-[env(safe-area-inset-top)] px-4 pb-2 bg-black/70">
            <button
              onClick={exitStreetView}
              className="mt-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg w-full"
            >
              ← Tilbage til kort
            </button>
          </div>
        )}

        {/* Overview: Start gennemgang button */}
        {!streetViewActive && mode === "overview" && steps.length > 0 && (
          <button
            onClick={enterStepMode}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg"
          >
            Start gennemgang
          </button>
        )}

        {/* Panels */}
        {!streetViewActive && panel === "filters" && (
          <div className="absolute bottom-2 left-3 right-3 z-10 bg-white rounded-xl shadow-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase text-slate-500">Vis på kort</span>
              <button onClick={() => setPanel("none")} className="text-slate-400 font-bold">✕</button>
            </div>
            {FILTER_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center gap-2 py-1.5 cursor-pointer">
                <input type="checkbox" checked={filters[item.key]} onChange={(e) => setFilters({ ...filters, [item.key]: e.target.checked })} className="w-4 h-4" />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
        )}

        {!streetViewActive && panel === "villas" && (
          <div className="absolute bottom-2 left-3 right-3 z-10 bg-white rounded-xl shadow-lg p-3 max-h-[50vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2 sticky top-0 bg-white pb-1">
              <span className="text-xs font-bold uppercase text-slate-500">Villa kvarterer ({villaStreets.length})</span>
              <button onClick={() => setPanel("none")} className="text-slate-400 font-bold">✕</button>
            </div>
            {villaStreets.map((s) => (
              <button
                key={s.id || s.name}
                onClick={() => { mapInstance.current?.panTo({ lat: s.lat, lng: s.lng }); mapInstance.current?.setZoom(17); setPanel("none"); }}
                className="w-full flex items-center justify-between py-2 border-b border-slate-100 text-sm hover:text-blue-500 text-left"
              >
                <span>{s.name}</span>
                <span className="text-slate-400 text-xs shrink-0 ml-2">{s.distance_m ? `${(s.distance_m / 1000).toFixed(1)} km` : ""}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reset view */}
        {!streetViewActive && outOfBounds && mode === "overview" && (
          <button onClick={resetView} className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
            Tilbage til rute
          </button>
        )}
      </div>

      {/* Step mode: bottom card — hidden during street view */}
      {!streetViewActive && mode === "step" && stepData && (
        <div className="bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 py-3">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl shrink-0 mt-0.5">{MANEUVER_ARROWS[stepData.maneuver] || "↑"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-snug">{stepData.instruction || "Fortsæt ligeud"}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stepData.distance_text}{stepData.duration_text ? ` — ${stepData.duration_text}` : ""}
                </p>
              </div>
              {speedLimit && (
                <div className="shrink-0 w-10 h-10 rounded-full bg-white border-[3px] border-red-600 flex items-center justify-center shadow">
                  <span className="text-sm font-bold text-black">{speedLimit}</span>
                </div>
              )}
            </div>

            {/* Nearby warnings — deduplicated by type */}
            {stepWarnings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {stepWarnings.map((w) => (
                  <span
                    key={w.type}
                    className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ background: TYPE_COLORS[w.type] || "#9ca3af" }}
                  >
                    {TYPE_LETTERS[w.type]} {TYPE_LABELS[w.type]}{w.count > 1 ? ` x${w.count}` : ""}
                  </span>
                ))}
              </div>
            )}

            {villaArea && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2">
                <span className="text-xs font-semibold text-amber-700">Villa kvarter — parkering, 3-punkt vending</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={goPrevStep} disabled={currentStep === 0} className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 py-3 rounded-xl font-semibold text-sm transition-colors">
                ← Forrige
              </button>
              <button onClick={openStreetViewAtStep} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl text-sm font-semibold transition-colors" title="Gadevisning">
                👁
              </button>
              <button onClick={goNextStep} disabled={currentStep === steps.length - 1} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 text-white py-3 rounded-xl font-semibold text-sm transition-colors">
                Næste →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar — overview only, hidden during street view */}
      {!streetViewActive && mode === "overview" && (
        <div className="bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around px-2 py-2">
            <button onClick={() => setPanel(panel === "filters" ? "none" : "filters")} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs ${panel === "filters" ? "text-blue-500 bg-blue-50" : "text-slate-600"}`}>
              <span className="text-lg">⚙</span><span>Filter</span>
            </button>
            <button onClick={() => setPanel(panel === "villas" ? "none" : "villas")} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs ${panel === "villas" ? "text-blue-500 bg-blue-50" : "text-slate-600"}`}>
              <span className="text-lg">🏘</span><span>Villa</span>
            </button>
            <button onClick={openStreetViewAtStep} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs text-slate-600">
              <span className="text-lg">👁</span><span>Gadevisning</span>
            </button>
            <button onClick={() => setMapType(mapType === "roadmap" ? "hybrid" : "roadmap")} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs text-slate-600">
              <span className="text-lg">{mapType === "roadmap" ? "🛰" : "🗺"}</span><span>{mapType === "roadmap" ? "Satellit" : "Kort"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
