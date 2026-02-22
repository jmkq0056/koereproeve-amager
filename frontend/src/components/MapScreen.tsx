import { useEffect, useRef, useCallback, useState } from "react";
import type { Intersection, Road, VillaStreet, RouteData, MarkerFilter, Step, GoogleSpeedLimit } from "../types";

interface Props {
  route: RouteData;
  intersections: Intersection[];
  roads: Road[];
  villaStreets: VillaStreet[];
  googleSpeeds: GoogleSpeedLimit[];
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

const IconPause = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);

const IconCar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
    <circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>
  </svg>
);

const IconStop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
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
  hojre_vigepligt: "Højre vigepligt",
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

function createTrafficLightMarker(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:22px;height:44px;border-radius:6px;background:#1a1a1a;border:2px solid #555;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px 0;`;
  for (const c of ["#ef4444", "#eab308", "#22c55e"]) {
    const dot = document.createElement("div");
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${c};box-shadow:0 0 4px ${c};`;
    el.appendChild(dot);
  }
  return el;
}

function createStopSignMarker(): HTMLDivElement {
  const el = document.createElement("div");
  // Octagon shape via clip-path
  el.style.cssText = `width:36px;height:36px;background:#dc2626;clip-path:polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);`;
  const inner = document.createElement("span");
  inner.style.cssText = `font-size:9px;font-weight:900;color:white;font-family:system-ui;letter-spacing:0.5px;`;
  inner.textContent = "STOP";
  el.appendChild(inner);
  return el;
}

function createYieldMarker(): HTMLDivElement {
  // Inverted triangle — ubetinget vigepligt
  const el = document.createElement("div");
  el.style.cssText = `width:0;height:0;border-left:18px solid transparent;border-right:18px solid transparent;border-top:32px solid #dc2626;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));position:relative;`;
  const inner = document.createElement("div");
  inner.style.cssText = `position:absolute;top:-28px;left:-12px;width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-top:22px solid white;`;
  el.appendChild(inner);
  return el;
}

function createHojreMarker(): HTMLDivElement {
  // Yellow diamond — højre vigepligt
  const el = document.createElement("div");
  el.style.cssText = `width:32px;height:32px;background:#eab308;transform:rotate(45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;`;
  const inner = document.createElement("span");
  inner.style.cssText = `transform:rotate(-45deg);font-size:13px;font-weight:900;color:white;font-family:system-ui;`;
  inner.textContent = "H";
  el.appendChild(inner);
  return el;
}

function createIntersectionMarker(type: string): HTMLDivElement {
  switch (type) {
    case "trafiklys": return createTrafficLightMarker();
    case "stopskilt": return createStopSignMarker();
    case "ubetinget_vigepligt": return createYieldMarker();
    case "hojre_vigepligt": return createHojreMarker();
    default: return createLetterMarker("?", "#9ca3af", 30);
  }
}

function createSpeedSign(speed: number): HTMLDivElement {
  if (speed <= 40) {
    return createZoneSign(speed);
  }
  // C55 Regular: red circle border, white bg, black number — BIG
  const el = document.createElement("div");
  el.style.cssText = `width:38px;height:38px;border-radius:50%;background:white;border:4px solid #dc2626;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#111;font-family:system-ui;`;
  el.textContent = String(speed);
  return el;
}

function createZoneSign(speed: number): HTMLDivElement {
  // E53 Zone: blue rounded square, white number, "Zone" text below — BIG
  const el = document.createElement("div");
  el.style.cssText = `width:40px;height:48px;border-radius:5px;background:#2563eb;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;line-height:1;`;
  const num = document.createElement("span");
  num.style.cssText = `font-weight:900;font-size:16px;color:white;`;
  num.textContent = String(speed);
  const zone = document.createElement("span");
  zone.style.cssText = `font-size:8px;color:white;font-weight:700;margin-top:1px;`;
  zone.textContent = "Zone";
  el.appendChild(num);
  el.appendChild(zone);
  return el;
}

function scaleForZoom(zoom: number): number {
  if (zoom >= 17) return 1;
  if (zoom >= 16) return 0.75;
  if (zoom >= 15) return 0.55;
  return 0.4;
}

function wrapScalable(inner: HTMLDivElement, zoom: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "marker-scale";
  el.style.cssText = `transform-origin:center;transform:scale(${scaleForZoom(zoom)});transition:transform 0.15s;`;
  el.appendChild(inner);
  return el;
}

const START_LAT = 55.634464;
const START_LNG = 12.650135;

export default function MapScreen({ route, intersections, roads, villaStreets, googleSpeeds, filters, setFilters, onBack, onSave }: Props) {
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
  const zoomRef = useRef(14);

  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("hybrid");
  const [panel, setPanel] = useState<"none" | "filters" | "villas">("none");
  const [outOfBounds, setOutOfBounds] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streetViewActive, setStreetViewActive] = useState(false);

  const [mapReady, setMapReady] = useState(false);
  const [mode, setMode] = useState<"overview" | "step">("overview");
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const [villaMode, setVillaMode] = useState(false);
  const prevFiltersRef = useRef<MarkerFilter | null>(null);

  // Auto mode state
  const [autoMode, setAutoMode] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Street View drive state
  const [svDriving, setSvDriving] = useState(false);
  const [svPointIndex, setSvPointIndex] = useState(0);
  const svPointsRef = useRef<{ lat: number; lng: number }[]>([]);
  const svDriveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      // Scale markers on zoom change
      map.addListener("zoom_changed", () => {
        const z = map.getZoom() || 14;
        zoomRef.current = z;
        const s = scaleForZoom(z);
        [...markersRef.current, ...speedMarkersRef.current].forEach((m) => {
          const el = m.content as HTMLElement;
          if (el?.classList.contains("marker-scale")) el.style.transform = `scale(${s})`;
        });
      });

      // Street view visible listener
      const sv = map.getStreetView();
      sv.addListener("visible_changed", () => setStreetViewActive(sv.getVisible()));

      setMapReady(true);
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

  // Intersection markers — mapReady ensures this runs after async map init
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    intersections.forEach((inter) => {
      const fk = inter.type as keyof MarkerFilter;
      if (fk in filters && !filters[fk]) return;

      const color = TYPE_COLORS[inter.type] || "#9ca3af";
      const label = TYPE_LABELS[inter.type] || inter.type;

      const pin = createIntersectionMarker(inter.type);
      const wrapped = wrapScalable(pin, zoomRef.current);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance.current!,
        position: { lat: inter.lat, lng: inter.lng },
        content: wrapped,
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
  }, [mapReady, intersections, filters]);

  // Speed signs — mapReady ensures this runs after async map init
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;
    speedMarkersRef.current.forEach((m) => (m.map = null));
    speedMarkersRef.current = [];
    if (!filters.speed_limits) return;

    const rPts = routePointsRef.current;

    if (googleSpeeds.length > 0) {
      // Use merged HERE + OSM speed limit points near route
      const shown = new Set<string>();
      googleSpeeds.forEach((gs) => {
        if (!gs.lat || !gs.lng || !gs.speedLimit) return;
        if (!nearRoute(gs.lat, gs.lng, rPts, 200)) return;
        // Deduplicate by grid cell (~100m)
        const gridKey = `${Math.round(gs.lat * 1000)}_${Math.round(gs.lng * 1000)}`;
        if (shown.has(gridKey)) return;
        shown.add(gridKey);

        const sign = createSpeedSign(gs.speedLimit);
        const wrapped = wrapScalable(sign, zoomRef.current);
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapInstance.current!,
          position: { lat: gs.lat, lng: gs.lng },
          content: wrapped,
          title: `${gs.speedLimit} km/t`,
        });
        marker.addListener("click", () => {
          infoWindowRef.current?.setContent(
            `<div style="font:13px system-ui;padding:4px"><strong>${gs.speedLimit} km/t</strong></div>`
          );
          infoWindowRef.current?.open(mapInstance.current!, marker);
        });
        speedMarkersRef.current.push(marker);
      });
    } else {
      // Fallback: OSM speed data
      roads.forEach((road) => {
        if (road.geometry.length < 2) return;
        if (SKIP_ROAD_TYPES.has(road.highway_type)) return;
        const isNear = road.geometry.some((g) => nearRoute(g.lat, g.lng, rPts, 200));
        if (!isNear) return;

        const midIdx = Math.floor(road.geometry.length / 2);
        const midPt = road.geometry[midIdx];
        const speedNum = parseInt(road.maxspeed) || 50;
        const sign = createSpeedSign(speedNum);
        const wrapped = wrapScalable(sign, zoomRef.current);
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapInstance.current!,
          position: { lat: midPt.lat, lng: midPt.lng },
          content: wrapped,
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
    }
  }, [mapReady, roads, googleSpeeds, filters.speed_limits]);

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

  const toggleVillaMode = useCallback(() => {
    if (!villaMode) {
      prevFiltersRef.current = { ...filters };
      setFilters({
        hojre_vigepligt: true,
        ubetinget_vigepligt: false,
        trafiklys: false,
        stopskilt: false,
        speed_limits: false,
      });
      setVillaMode(true);
    } else {
      if (prevFiltersRef.current) setFilters(prevFiltersRef.current);
      else setFilters({ hojre_vigepligt: true, ubetinget_vigepligt: true, trafiklys: true, stopskilt: true, speed_limits: true });
      setVillaMode(false);
    }
  }, [villaMode, filters, setFilters]);

  const stopAutoMode = useCallback(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoMode(false);
  }, []);

  const goNextStep = useCallback(() => {
    stopAutoMode();
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length, stopAutoMode]);

  const goPrevStep = useCallback(() => {
    stopAutoMode();
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, [stopAutoMode]);

  const toggleAutoMode = useCallback(() => {
    if (autoMode) {
      stopAutoMode();
      return;
    }
    setAutoMode(true);
    autoTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          stopAutoMode();
          return prev;
        }
        return prev + 1;
      });
    }, 3500);
  }, [autoMode, steps.length, stopAutoMode]);

  // Cleanup auto timer on unmount
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
      if (svDriveTimerRef.current) clearInterval(svDriveTimerRef.current);
    };
  }, []);

  // Street View drive: sample route polyline every ~30m
  const startSvDrive = useCallback(() => {
    const rPts = routePointsRef.current;
    if (rPts.length < 2) return;

    // Sample points every ~30m
    const sampled: { lat: number; lng: number }[] = [rPts[0]];
    let accumulated = 0;
    for (let i = 1; i < rPts.length; i++) {
      accumulated += distM(rPts[i - 1].lat, rPts[i - 1].lng, rPts[i].lat, rPts[i].lng);
      if (accumulated >= 30) {
        sampled.push(rPts[i]);
        accumulated = 0;
      }
    }
    if (sampled.length < 2) return;

    svPointsRef.current = sampled;
    setSvPointIndex(0);
    setSvDriving(true);

    // Open street view at first point
    const map = mapInstance.current;
    if (!map) return;
    const sv = map.getStreetView();
    const first = sampled[0];
    const second = sampled[1];
    const heading = google.maps.geometry.spherical.computeHeading(
      new google.maps.LatLng(first.lat, first.lng),
      new google.maps.LatLng(second.lat, second.lng)
    );
    sv.setPosition({ lat: first.lat, lng: first.lng });
    sv.setPov({ heading, pitch: 0 });
    sv.setVisible(true);

    // Start auto-advance timer
    let idx = 0;
    svDriveTimerRef.current = setInterval(() => {
      idx++;
      if (idx >= sampled.length) {
        stopSvDrive();
        return;
      }
      setSvPointIndex(idx);
      const pt = sampled[idx];
      const nextPt = sampled[Math.min(idx + 1, sampled.length - 1)];
      const h = google.maps.geometry.spherical.computeHeading(
        new google.maps.LatLng(pt.lat, pt.lng),
        new google.maps.LatLng(nextPt.lat, nextPt.lng)
      );
      sv.setPosition({ lat: pt.lat, lng: pt.lng });
      sv.setPov({ heading: h, pitch: 0 });
    }, 2000);
  }, []);

  const stopSvDrive = useCallback(() => {
    if (svDriveTimerRef.current) {
      clearInterval(svDriveTimerRef.current);
      svDriveTimerRef.current = null;
    }
    setSvDriving(false);
    setSvPointIndex(0);
    mapInstance.current?.getStreetView().setVisible(false);
  }, []);

  // Nearby intersections for current step — deduplicated by type
  const getStepWarnings = useCallback((): { type: string; count: number }[] => {
    if (mode !== "step" || !steps[currentStep]) return [];
    const step = steps[currentStep];
    const nearby = intersections.filter(
      (i) => nearPoint(i.lat, i.lng, step.startLat, step.startLng, 80) ||
             nearPoint(i.lat, i.lng, step.endLat, step.endLng, 80)
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

  // Speed for step — prefer Google data, fallback to OSM
  const getSpeedForStep = useCallback((): number | null => {
    if (mode !== "step" || !steps[currentStep]) return null;
    const step = steps[currentStep];

    // Try Google speed data first
    if (googleSpeeds.length > 0) {
      let closest: GoogleSpeedLimit | null = null;
      let closestDist = Infinity;
      for (const gs of googleSpeeds) {
        if (!gs.lat || !gs.lng || !gs.speedLimit) continue;
        const d = distM(gs.lat, gs.lng, step.startLat, step.startLng);
        if (d < 80 && d < closestDist) {
          closestDist = d;
          closest = gs;
        }
      }
      if (closest) return closest.speedLimit;
    }

    // Fallback: OSM
    for (const road of roads) {
      if (SKIP_ROAD_TYPES.has(road.highway_type)) continue;
      if (road.geometry.some((g) => nearPoint(g.lat, g.lng, step.startLat, step.startLng, 60))) {
        return parseInt(road.maxspeed) || null;
      }
    }
    return null;
  }, [mode, currentStep, steps, roads, googleSpeeds]);

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

        {/* Street view exit + drive controls */}
        {streetViewActive && (
          <div className="absolute top-0 left-0 right-0 z-20 pt-[max(env(safe-area-inset-top),8px)] px-4 pb-2 bg-black/60 backdrop-blur-sm">
            {svDriving && (
              <div className="mt-2 mb-2 flex items-center justify-between bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Kører... ({svPointIndex + 1}/{svPointsRef.current.length})
                </span>
                <button onClick={stopSvDrive} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs flex items-center gap-1">
                  <IconStop />
                  Stop
                </button>
              </div>
            )}
            <button
              onClick={() => { if (svDriving) stopSvDrive(); else exitStreetView(); }}
              className="bg-white text-slate-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg w-full flex items-center justify-center gap-2 active:bg-slate-100"
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
              <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Vis på kort</span>
              <button onClick={() => setPanel("none")} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                <IconX />
              </button>
            </div>
            {FILTER_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center gap-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={filters[item.key]} onChange={(e) => setFilters({ ...filters, [item.key]: e.target.checked })} className="w-5 h-5 rounded" />
                <span className="w-5 h-5 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-base text-slate-700 font-medium">{item.label}</span>
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
                <p className="text-sm font-semibold text-slate-800 leading-snug">{stepData.instruction || "Fortsæt ligeud"}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {stepData.distance_text}{stepData.duration_text ? ` -- ${stepData.duration_text}` : ""}
                </p>
              </div>
              {speedLimit && (
                speedLimit <= 40 ? (
                  <div className="shrink-0 w-10 h-12 rounded bg-blue-600 border-2 border-white flex flex-col items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-white">{speedLimit}</span>
                    <span className="text-[7px] font-semibold text-white">Zone</span>
                  </div>
                ) : (
                  <div className="shrink-0 w-10 h-10 rounded-full bg-white border-[3px] border-red-600 flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-black">{speedLimit}</span>
                  </div>
                )
              )}
            </div>

            {/* Warnings */}
            {stepWarnings.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {stepWarnings.map((w) => (
                  <div
                    key={w.type}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-white font-semibold text-sm shadow-md"
                    style={{ background: TYPE_COLORS[w.type] || "#9ca3af" }}
                  >
                    <span className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-xs font-black">
                      {TYPE_LETTERS[w.type]}
                    </span>
                    <span>{TYPE_LABELS[w.type]}{w.count > 1 ? ` x${w.count}` : ""}</span>
                  </div>
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
              <button onClick={toggleAutoMode} className={`px-4 py-3 rounded-xl transition-colors flex items-center justify-center ${autoMode ? "bg-amber-100 text-amber-700" : "bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700"}`} title={autoMode ? "Pause auto" : "Auto gennemgang"}>
                {autoMode ? <IconPause /> : <IconCar />}
              </button>
              <button onClick={openStreetViewAtStep} className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 px-4 py-3 rounded-xl transition-colors flex items-center justify-center" title="Gadevisning">
                <IconEye />
              </button>
              <button onClick={goNextStep} disabled={currentStep === steps.length - 1} className="flex-1 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-30 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1">
                Næste
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
            <button onClick={toggleVillaMode} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-colors ${villaMode ? "text-red-500 bg-red-50" : "text-slate-500"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${villaMode ? "bg-red-500" : "bg-slate-400"}`}>H</span>
              <span>Villa</span>
            </button>
            <button onClick={() => setPanel(panel === "filters" ? "none" : "filters")} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-colors ${panel === "filters" ? "text-blue-500 bg-blue-50" : "text-slate-500"}`}>
              <IconFilter />
              <span>Filter</span>
            </button>
            <button onClick={startSvDrive} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-slate-500 transition-colors">
              <IconCar />
              <span>Kør rute</span>
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
