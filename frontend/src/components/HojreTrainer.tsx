import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { Intersection, VillaStreet } from "../types";

interface Props {
  junctions: Intersection[];
  villaStreets: VillaStreet[];
  onBack: () => void;
}

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const START_LAT = 55.634464;
const START_LNG = 12.650135;
const STORAGE_KEY = "hojre_trainer_seen";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadSeen(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

// Icons
const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconEye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconSkip = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

function createHMarker(size: number, active: boolean): HTMLDivElement {
  if (active) {
    // Big pulsing diamond marker for active junction
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `position:relative;width:${size + 20}px;height:${size + 20}px;display:flex;align-items:center;justify-content:center;`;
    // Pulse ring
    const pulse = document.createElement("div");
    pulse.style.cssText = `position:absolute;width:${size + 16}px;height:${size + 16}px;border-radius:50%;background:rgba(239,68,68,0.3);animation:hpulse 1.5s ease-in-out infinite;`;
    // Inner diamond
    const diamond = document.createElement("div");
    diamond.style.cssText = `width:${size}px;height:${size}px;background:#dc2626;transform:rotate(45deg);border:4px solid white;box-shadow:0 0 20px rgba(239,68,68,0.8),0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10;position:relative;`;
    const letter = document.createElement("span");
    letter.style.cssText = `transform:rotate(-45deg);font-weight:900;font-size:${Math.round(size * 0.4)}px;color:white;font-family:system-ui;`;
    letter.textContent = "H";
    diamond.appendChild(letter);
    wrapper.appendChild(pulse);
    wrapper.appendChild(diamond);
    // Inject pulse animation
    if (!document.getElementById("hpulse-style")) {
      const style = document.createElement("style");
      style.id = "hpulse-style";
      style.textContent = `@keyframes hpulse{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.6);opacity:0}}`;
      document.head.appendChild(style);
    }
    return wrapper;
  }
  // Small gray circle for inactive
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:#6b7280;border:2px solid rgba(255,255,255,0.5);box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:${Math.round(size * 0.45)}px;color:white;font-family:system-ui;opacity:0.6;`;
  el.textContent = "H";
  return el;
}

function createStartMarker(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:32px;height:32px;border-radius:50%;background:#16a34a;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;color:white;font-family:system-ui;`;
  el.textContent = "S";
  return el;
}

export default function HojreTrainer({ junctions, villaStreets, onBack }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const startMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const allMarkersRef = useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const svServiceRef = useRef<google.maps.StreetViewService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const routeCacheRef = useRef<Map<number, google.maps.DirectionsResult>>(new Map());
  const hiddenGrayRef = useRef<number | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(loadSeen);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [streetViewActive, setStreetViewActive] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);

  // Shuffle junctions: unseen first, then seen — stable per session
  const ordered = useMemo(() => {
    const unseen = shuffleArray(junctions.filter((j) => !seen.has(j.id)));
    const seenList = shuffleArray(junctions.filter((j) => seen.has(j.id)));
    return [...unseen, ...seenList];
  }, [junctions]); // Only re-shuffle on mount, not when seen changes

  const current = ordered[currentIdx];
  const total = junctions.length;
  const seenCount = seen.size;
  const allDone = seenCount >= total && total > 0;

  // Nearest villa street name + distance from start
  const villaInfo = useMemo(() => {
    if (!current) return null;
    let best: VillaStreet | null = null;
    let bestDist = Infinity;
    for (const v of villaStreets) {
      const d = distM(current.lat, current.lng, v.lat, v.lng);
      if (d < bestDist) { bestDist = d; best = v; }
    }
    if (!best || bestDist > 500) return null;
    const fromStart = distM(current.lat, current.lng, START_LAT, START_LNG);
    return { name: best.name, distFromStart: Math.round(fromStart) };
  }, [current, villaStreets]);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;
    const init = async () => {
      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      await google.maps.importLibrary("marker");
      await google.maps.importLibrary("streetView");

      const map = new Map(mapRef.current!, {
        center: { lat: current?.lat || START_LAT, lng: current?.lng || START_LNG },
        zoom: 18,
        mapId: "koereproeve-trainer",
        mapTypeId: "hybrid",
        streetViewControl: true,
        streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
        fullscreenControl: false,
        mapTypeControl: false,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
      });
      mapInstance.current = map;
      svServiceRef.current = new google.maps.StreetViewService();

      // Street view listener
      const sv = map.getStreetView();
      sv.addListener("visible_changed", () => setStreetViewActive(sv.getVisible()));

      // Start marker (køreprøve sted)
      startMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: START_LAT, lng: START_LNG },
        content: createStartMarker(),
        title: "Vindblæs Alle 2 (start)",
        zIndex: 50,
      });

      // Show all junctions as small gray markers
      for (const j of junctions) {
        const el = createHMarker(18, false);
        const m = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: j.lat, lng: j.lng },
          content: el,
          zIndex: 1,
        });
        allMarkersRef.current.set(j.id, m);
      }

      setMapReady(true);
    };
    init();
    return () => {
      allMarkersRef.current.forEach((m) => (m.map = null));
      markerRef.current && (markerRef.current.map = null);
      startMarkerRef.current && (startMarkerRef.current.map = null);
      directionsRendererRef.current?.setMap(null);
    };
  }, []);

  // Update active marker + driving route when currentIdx changes or map becomes ready
  useEffect(() => {
    if (!mapReady || !mapInstance.current || !current) return;
    const map = mapInstance.current;

    // Restore previously hidden gray marker
    if (hiddenGrayRef.current !== null) {
      const prev = allMarkersRef.current.get(hiddenGrayRef.current);
      if (prev) prev.map = map;
    }

    // Hide gray marker at current junction so active diamond is clean
    const gray = allMarkersRef.current.get(current.id);
    if (gray) gray.map = null;
    hiddenGrayRef.current = current.id;

    // Remove old active marker
    if (markerRef.current) markerRef.current.map = null;

    // Create big active marker (pulsing diamond)
    const el = createHMarker(44, true);
    markerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: current.lat, lng: current.lng },
      content: el,
      zIndex: 100,
    });

    // Draw actual driving route from start to current junction
    directionsRendererRef.current?.setMap(null);
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#ef4444",
        strokeOpacity: 0.6,
        strokeWeight: 5,
      },
    });
    directionsRendererRef.current = renderer;

    const cached = routeCacheRef.current.get(current.id);
    if (cached) {
      renderer.setDirections(cached);
    } else {
      new google.maps.DirectionsService().route(
        {
          origin: { lat: START_LAT, lng: START_LNG },
          destination: { lat: current.lat, lng: current.lng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            routeCacheRef.current.set(current.id, result);
            renderer.setDirections(result);
          }
        }
      );
    }

    // Pan to junction, zoom to show both start and junction
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: START_LAT, lng: START_LNG });
    bounds.extend({ lat: current.lat, lng: current.lng });
    map.fitBounds(bounds, { top: 80, bottom: 100, left: 40, right: 40 });
  }, [mapReady, currentIdx, current]);

  const markSeen = useCallback(() => {
    if (!current) return;
    const next = new Set(seen);
    next.add(current.id);
    setSeen(next);
    saveSeen(next);

    // Check if all done
    if (next.size >= total) {
      setShowAllDone(true);
      return;
    }

    // Move to next
    if (currentIdx < ordered.length - 1) {
      setCurrentIdx((p) => p + 1);
    } else {
      setCurrentIdx(0);
    }
  }, [current, seen, total, currentIdx, ordered.length]);

  const skip = useCallback(() => {
    if (currentIdx < ordered.length - 1) {
      setCurrentIdx((p) => p + 1);
    } else {
      setCurrentIdx(0);
    }
  }, [currentIdx, ordered.length]);

  const openStreetView = useCallback(() => {
    const map = mapInstance.current;
    const svService = svServiceRef.current;
    if (!map || !svService || !current) return;

    svService.getPanorama(
      {
        location: { lat: current.lat, lng: current.lng },
        radius: 200,
        preference: google.maps.StreetViewPreference.NEAREST,
        source: google.maps.StreetViewSource.OUTDOOR,
      },
      (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
          const sv = map.getStreetView();
          sv.setPosition(data.location.latLng);
          sv.setPov({ heading: 0, pitch: 0 });
          sv.setVisible(true);
        }
      }
    );
  }, [current]);

  const exitStreetView = useCallback(() => {
    mapInstance.current?.getStreetView().setVisible(false);
  }, []);

  const resetProgress = useCallback(() => {
    const empty = new Set<number>();
    setSeen(empty);
    saveSeen(empty);
    setShowAllDone(false);
    setCurrentIdx(0);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "d") skip();
      else if (e.key === "ArrowLeft" || e.key === "a") {
        setCurrentIdx((p) => Math.max(p - 1, 0));
      }
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); markSeen(); }
      else if (e.key === "v" || e.key === "e") openStreetView();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [skip, markSeen, openStreetView]);

  if (junctions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <p className="text-lg font-bold mb-2">Ingen højre vigepligt fundet</p>
          <button onClick={onBack} className="text-blue-400 underline">Tilbage</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative flex flex-col">
      {/* Top bar */}
      <div className={`bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 pt-[max(env(safe-area-inset-top),8px)] ${streetViewActive ? "hidden" : ""}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={onBack} className="text-blue-400 p-1.5 -ml-1 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors shrink-0">
            <IconBack />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <span className="font-bold text-sm text-white">Højre Vigepligt Træning</span>
          </div>
          <button
            onClick={resetProgress}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Nulstil"
          >
            <IconRefresh />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400 font-bold shrink-0">H</span>
            <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (seenCount / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 shrink-0 tabular-nums font-medium">
              {seenCount}/{total}
            </span>
          </div>
          {!allDone && (
            <div className="mt-1 text-center">
              <p className="text-[10px] text-slate-500">
                #{currentIdx + 1} — {seen.has(current?.id) ? "allerede set" : "ny"}
              </p>
              {villaInfo && (
                <p className="text-xs text-amber-400 font-medium mt-0.5">
                  {villaInfo.name} — {villaInfo.distFromStart < 1000 ? `${villaInfo.distFromStart}m` : `${(villaInfo.distFromStart / 1000).toFixed(1)}km`} fra start
                </p>
              )}
            </div>
          )}
        </div>
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

        {/* All done overlay */}
        {showAllDone && !streetViewActive && (
          <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-800 rounded-2xl p-6 mx-6 text-center border border-slate-600">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Færdigt!</h2>
              <p className="text-slate-300 text-sm mb-4">
                Du har set alle {total} højre vigepligt kryds.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={resetProgress}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  Start forfra
                </button>
                <button
                  onClick={onBack}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  Tilbage
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {!streetViewActive && !showAllDone && (
        <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 pb-[max(env(safe-area-inset-bottom),8px)]">
          <div className="px-4 py-3">
            <div className="flex gap-2">
              <button
                onClick={skip}
                className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <IconSkip />
                Spring over
              </button>
              <button
                onClick={openStreetView}
                className="bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white px-4 py-3.5 rounded-xl transition-colors flex items-center justify-center"
                title="Gadevisning"
              >
                <IconEye />
              </button>
              <button
                onClick={markSeen}
                className="flex-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <IconCheck />
                Set / Næste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
