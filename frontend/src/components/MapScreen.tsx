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

// --- SVG Icons (16x16 unless noted) ---
const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconSave = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconSaveFilled = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconFilter = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
);

const IconHouse = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconEye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconLayers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconPlay = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

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
  hojre_vigepligt: "Hoejre vigepligt",
  ubetinget_vigepligt: "Ubetinget vigepligt",
  trafiklys: "Trafiklys",
  stopskilt: "Stopskilt",
};

const MANEUVER_ARROWS: Record<string, string> = {
  TURN_LEFT: "\u21B0",
  TURN_RIGHT: "\u21B1",
  TURN_SLIGHT_LEFT: "\u2196",
  TURN_SLIGHT_RIGHT: "\u2197",
  TURN_SHARP_LEFT: "\u2BA2",
  TURN_SHARP_RIGHT: "\u2BA3",
  UTURN_LEFT: "\u2B8C",
  UTURN_RIGHT: "\u2B8E",
  STRAIGHT: "\u2191",
  DEPART: "\u25CF",
  ROUNDABOUT_LEFT: "\u21BA",
  ROUNDABOUT_RIGHT: "\u21BB",
  RAMP_LEFT: "\u21B0",
  RAMP_RIGHT: "\u21B1",
  MERGE: "\u2A5A",
  FORK_LEFT: "\u21B0",
  FORK_RIGHT: "\u21B1",
  NAME_CHANGE: "\u2191",
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
          `<div style="font:13px system-ui;padding:4px"><strong>Start / Slut</strong><br/>Vindblaes Alle 2, 2770 Kastrup</div>`
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

  // Intersection markers
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
        title: `${road.name} -- ${road.maxspeed} km/t`,
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

  // Nearby intersections for current step — deduplicated by type
  const getStepWarnings = useCallback((): { type: string; count: number }[] => {
    if (mode !== "step" || !steps[currentStep]) return [];
    const step = steps[currentStep];
    const nearby = intersections.filter(
      (i) => nearPoint(i.lat, i.lng, step.startLat, step.startLng, 40) ||
             nearPoint(i.lat, i.lng, step.endLat, step.endLng, 40)
    );
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
    { key: "hojre_vigepligt", label: "Hoejre vigepligt", color: "#ef4444" },
    { key: "ubetinget_vigepligt", label: "Ubetinget vigepligt", color: "#3b82f6" },
    { key: "trafiklys", label: "Trafiklys", color: "#22c55e" },
    { key: "stopskilt", label: "Stopskilt", color: "#eab308" },
    { key: "speed_limits", label: "Hastighed", color: "#a855f7" },
  ];

  const stepData = steps[currentStep];
  const stepWarnings = getStepWarnings();
  const villaArea = getVillaForStep();
  const speedLimit = getSpeedForStep();

  return (
    <div className="h-full relative flex flex-col">
      {/* Top bar */}
      <div className={`bg-white/95 backdrop-blur-sm border-b border-slate-200 pt-[max(env(safe-area-inset-top),8px)] ${streetViewActive ? "hidden" : ""}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={onBack} className="text-blue-500 p-1.5 -ml-1 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors shrink-0">
            <IconBack />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <span className="font-bold text-sm">{route.duration_minutes} min</span>
            <span className="text-slate-300 text-xs mx-1.5">|</span>
            <span className="text-sm text-slate-600">{(route.distance_meters / 1000).toFixed(1)} km</span>
            <span
              className={`text-xs ml-2 px-2 py-0.5 rounded-full font-medium ${
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
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${saved ? "text-green-500" : "text-blue-500 hover:bg-blue-50 active:bg-blue-100"}`}
          >
            {saved ? <IconSaveFilled /> : <IconSave />}
          </button>
        </div>

        {mode === "step" && steps.length > 0 && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2">
              <button onClick={exitStepMode} className="text-xs text-blue-500 font-semibold shrink-0 flex items-center gap-0.5">
                <IconList />
                Oversigt
              </button>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-400 shrink-0 tabular-nums">{currentStep + 1}/{steps.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* Street view exit */}
        {streetViewActive && (
          <div className="absolute top-0 left-0 right-0 z-20 pt-[max(env(safe-area-inset-top),8px)] px-4 pb-2 bg-black/60 backdrop-blur-sm">
            <button
              onClick={exitStreetView}
              className="mt-2 bg-white text-slate-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg w-full flex items-center justify-center gap-2 active:bg-slate-100"
            >
              <IconBack />
              Tilbage til kort
            </button>
          </div>
        )}

        {/* Overview: Start button */}
        {!streetViewActive && mode === "overview" && steps.length > 0 && (
          <button
            onClick={enterStepMode}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2 transition-colors"
          >
            <IconPlay />
            Start gennemgang
          </button>
        )}

        {/* Filter panel */}
        {!streetViewActive && panel === "filters" && (
          <div className="absolute bottom-2 left-3 right-3 z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-4 border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Vis paa kort</span>
              <button onClick={() => setPanel("none")} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                <IconX />
              </button>
            </div>
            {FILTER_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center gap-3 py-2 cursor-pointer">
                <input type="checkbox" checked={filters[item.key]} onChange={(e) => setFilters({ ...filters, [item.key]: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* Villa panel */}
        {!streetViewActive && panel === "villas" && (
          <div className="absolute bottom-2 left-3 right-3 z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-4 max-h-[50vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center mb-3 sticky top-0 bg-white/95 backdrop-blur-sm pb-2">
              <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Villakvarterer ({villaStreets.length})</span>
              <button onClick={() => setPanel("none")} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                <IconX />
              </button>
            </div>
            {villaStreets.map((s) => (
              <button
                key={s.id || s.name}
                onClick={() => { mapInstance.current?.panTo({ lat: s.lat, lng: s.lng }); mapInstance.current?.setZoom(17); setPanel("none"); }}
                className="w-full flex items-center justify-between py-2.5 border-b border-slate-100 text-sm hover:text-blue-500 text-left transition-colors"
              >
                <span>{s.name}</span>
                <span className="text-slate-400 text-xs shrink-0 ml-2">{s.distance_m ? `${(s.distance_m / 1000).toFixed(1)} km` : ""}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reset view */}
        {!streetViewActive && outOfBounds && mode === "overview" && (
          <button onClick={resetView} className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white text-blue-500 px-4 py-2 rounded-full text-xs font-semibold shadow-lg border border-slate-200 active:bg-slate-50">
            Tilbage til rute
          </button>
        )}
      </div>

      {/* Step bottom card */}
      {!streetViewActive && mode === "step" && stepData && (
        <div className="bg-white border-t border-slate-200 pb-[max(env(safe-area-inset-bottom),8px)]">
          <div className="px-4 py-3">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl shrink-0 mt-0.5 w-8 text-center font-mono">{MANEUVER_ARROWS[stepData.maneuver] || "\u2191"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-snug">{stepData.instruction || "Fortsaet ligeud"}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {stepData.distance_text}{stepData.duration_text ? ` -- ${stepData.duration_text}` : ""}
                </p>
              </div>
              {speedLimit && (
                <div className="shrink-0 w-10 h-10 rounded-full bg-white border-[3px] border-red-600 flex items-center justify-center shadow-sm">
                  <span className="text-sm font-bold text-black">{speedLimit}</span>
                </div>
              )}
            </div>

            {/* Warnings */}
            {stepWarnings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {stepWarnings.map((w) => (
                  <span
                    key={w.type}
                    className="text-xs px-2.5 py-1 rounded-full text-white font-medium"
                    style={{ background: TYPE_COLORS[w.type] || "#9ca3af" }}
                  >
                    {TYPE_LETTERS[w.type]} {TYPE_LABELS[w.type]}{w.count > 1 ? ` x${w.count}` : ""}
                  </span>
                ))}
              </div>
            )}

            {villaArea && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                <span className="text-xs font-semibold text-amber-700">Villakvarter -- parkering, 3-punkt vending</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={goPrevStep} disabled={currentStep === 0} className="flex-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 text-slate-700 py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1">
                <IconChevronLeft />
                Forrige
              </button>
              <button onClick={openStreetViewAtStep} className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 px-4 py-3 rounded-xl transition-colors flex items-center justify-center" title="Gadevisning">
                <IconEye />
              </button>
              <button onClick={goNextStep} disabled={currentStep === steps.length - 1} className="flex-1 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-30 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1">
                Naeste
                <IconChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar — overview */}
      {!streetViewActive && mode === "overview" && (
        <div className="bg-white/95 backdrop-blur-sm border-t border-slate-200 pb-[max(env(safe-area-inset-bottom),8px)]">
          <div className="flex items-center justify-around px-2 py-1.5">
            <button onClick={() => setPanel(panel === "filters" ? "none" : "filters")} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-colors ${panel === "filters" ? "text-blue-500 bg-blue-50" : "text-slate-500"}`}>
              <IconFilter />
              <span>Filter</span>
            </button>
            <button onClick={() => setPanel(panel === "villas" ? "none" : "villas")} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-colors ${panel === "villas" ? "text-blue-500 bg-blue-50" : "text-slate-500"}`}>
              <IconHouse />
              <span>Villa</span>
            </button>
            <button onClick={openStreetViewAtStep} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-slate-500 transition-colors">
              <IconEye />
              <span>Gadevisning</span>
            </button>
            <button onClick={() => setMapType(mapType === "roadmap" ? "hybrid" : "roadmap")} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-slate-500 transition-colors">
              <IconLayers />
              <span>{mapType === "roadmap" ? "Satellit" : "Kort"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
