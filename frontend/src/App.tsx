import { useState, useEffect, useCallback } from "react";
import HomeScreen from "./components/HomeScreen";
import MapScreen from "./components/MapScreen";
import HojreTrainer from "./components/HojreTrainer";
import {
  fetchRoute,
  fetchHojreVigepligt,
  fetchSpeedLimits,
  fetchVillaAreas,
} from "./api";
import type { Intersection, Road, VillaStreet, RouteData, MarkerFilter, Screen } from "./types";

const G_API_KEY = import.meta.env.VITE_G_API_KEY;

function App() {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");

  // Data
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [villaStreets, setVillaStreets] = useState<VillaStreet[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [filters, setFilters] = useState<MarkerFilter>({
    hojre_vigepligt: true,
    ubetinget_vigepligt: true,
    trafiklys: true,
    stopskilt: true,
    speed_limits: true,
  });

  // Loading states
  const [routeLoading, setRouteLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved routes from localStorage
  const [savedRoutes, setSavedRoutes] = useState<RouteData[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("saved_routes") || "[]");
    } catch { return []; }
  });

  // Load Google Maps
  useEffect(() => {
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      setMapsLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${G_API_KEY}&libraries=geometry,marker&v=weekly`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Load overpass data once maps are ready
  useEffect(() => {
    if (!mapsLoaded) return;
    setDataLoading(true);
    Promise.all([
      fetchHojreVigepligt().catch(() => ({ hojre_vigepligt: [], signed: [] })),
      fetchSpeedLimits().catch(() => ({ roads: [] })),
      fetchVillaAreas().catch(() => ({ villa_streets: [], neighborhoods: [] })),
    ]).then(([vigepligt, speed, villa]) => {
      setIntersections([...vigepligt.hojre_vigepligt, ...vigepligt.signed]);
      setRoads(speed.roads);
      setVillaStreets(villa.villa_streets);
    }).finally(() => setDataLoading(false));
  }, [mapsLoaded]);

  const handleGenerateRoute = useCallback(async (includeMotorway: boolean) => {
    setRouteLoading(true);
    setError(null);
    try {
      const data = await fetchRoute(includeMotorway);
      if (data.routes.length > 0) {
        const best = data.routes[0];
        const route: RouteData = {
          duration_minutes: best.duration_minutes,
          distance_meters: best.distance_meters,
          polyline: best.polyline,
          include_motorway: includeMotorway,
          legs: best.legs,
        };
        setActiveRoute(route);
        setScreen("map");
      } else {
        setError("Ingen ruter fundet");
      }
    } catch (err) {
      setError("Kunne ikke beregne rute");
      console.error(err);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const handleSaveRoute = useCallback(() => {
    if (!activeRoute) return;
    const updated = [...savedRoutes, activeRoute];
    setSavedRoutes(updated);
    localStorage.setItem("saved_routes", JSON.stringify(updated));
  }, [activeRoute, savedRoutes]);

  const handleDeleteRoute = useCallback((index: number) => {
    const updated = savedRoutes.filter((_, i) => i !== index);
    setSavedRoutes(updated);
    localStorage.setItem("saved_routes", JSON.stringify(updated));
  }, [savedRoutes]);

  const handleLoadRoute = useCallback((route: RouteData) => {
    setActiveRoute(route);
    setScreen("map");
  }, []);

  const handleBackToHome = useCallback(() => {
    setActiveRoute(null);
    setScreen("home");
  }, []);

  const handleStartTrainer = useCallback(() => {
    setScreen("trainer");
  }, []);

  if (!mapsLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Indlæser kort...</p>
        </div>
      </div>
    );
  }

  if (screen === "trainer") {
    const hojreOnly = intersections.filter((i) => i.type === "hojre_vigepligt");
    return <HojreTrainer junctions={hojreOnly} onBack={handleBackToHome} />;
  }

  if (screen === "map" && activeRoute) {
    return (
      <MapScreen
        route={activeRoute}
        intersections={intersections}
        roads={roads}
        villaStreets={villaStreets}
        filters={filters}
        setFilters={setFilters}
        onBack={handleBackToHome}
        onSave={handleSaveRoute}
      />
    );
  }

  const hojreCount = intersections.filter((i) => i.type === "hojre_vigepligt").length;

  return (
    <HomeScreen
      onGenerateRoute={handleGenerateRoute}
      onStartTrainer={handleStartTrainer}
      hojreCount={hojreCount}
      loading={routeLoading}
      dataLoading={dataLoading}
      error={error}
      savedRoutes={savedRoutes}
      onLoadRoute={handleLoadRoute}
      onDeleteRoute={handleDeleteRoute}
      villaStreets={villaStreets}
    />
  );
}

export default App;
