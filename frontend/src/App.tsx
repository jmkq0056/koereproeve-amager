import { useState, useEffect, useCallback } from "react";
import MapView from "./components/MapView";
import ControlPanel from "./components/ControlPanel";
import VillaList from "./components/VillaList";
import {
  fetchRoute,
  fetchHojreVigepligt,
  fetchSpeedLimits,
  fetchVillaAreas,
} from "./api";
import type { Intersection, Road, VillaStreet, Neighborhood, MarkerFilter } from "./types";

const G_API_KEY = import.meta.env.VITE_G_API_KEY;

function App() {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [includeMotorway, setIncludeMotorway] = useState(true);
  const [filters, setFilters] = useState<MarkerFilter>({
    hojre_vigepligt: true,
    ubetinget_vigepligt: true,
    trafiklys: true,
    stopskilt: true,
    speed_limits: true,
  });
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [villaStreets, setVillaStreets] = useState<VillaStreet[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [routePolyline, setRoutePolyline] = useState<string>();
  const [routeInfo, setRouteInfo] = useState<{
    duration_minutes: number;
    distance_meters: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [villaLoading, setVillaLoading] = useState(false);

  // Load Google Maps script
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

  // Load initial data
  useEffect(() => {
    if (!mapsLoaded) return;

    const loadData = async () => {
      try {
        const [vigepligtData, speedData] = await Promise.all([
          fetchHojreVigepligt(),
          fetchSpeedLimits(),
        ]);

        const allIntersections = [
          ...vigepligtData.hojre_vigepligt,
          ...vigepligtData.signed,
        ];
        setIntersections(allIntersections);
        setRoads(speedData.roads);
      } catch (err) {
        console.error("Failed to load map data:", err);
      }
    };

    const loadVillas = async () => {
      setVillaLoading(true);
      try {
        const data = await fetchVillaAreas();
        setVillaStreets(data.villa_streets);
        setNeighborhoods(data.neighborhoods);
      } catch (err) {
        console.error("Failed to load villa areas:", err);
      } finally {
        setVillaLoading(false);
      }
    };

    loadData();
    loadVillas();
  }, [mapsLoaded]);

  const handleGenerateRoute = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRoute(includeMotorway);
      if (data.routes.length > 0) {
        const best = data.routes[0];
        setRoutePolyline(best.polyline);
        setRouteInfo({
          duration_minutes: best.duration_minutes,
          distance_meters: best.distance_meters,
        });
      }
    } catch (err) {
      console.error("Failed to generate route:", err);
    } finally {
      setLoading(false);
    }
  }, [includeMotorway]);

  if (!mapsLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Indlæser kort...</p>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <MapView
        intersections={intersections}
        roads={roads}
        filters={filters}
        routePolyline={routePolyline}
      />
      <ControlPanel
        includeMotorway={includeMotorway}
        setIncludeMotorway={setIncludeMotorway}
        filters={filters}
        setFilters={setFilters}
        onGenerateRoute={handleGenerateRoute}
        loading={loading}
        routeInfo={routeInfo}
      />
      <VillaList
        streets={villaStreets}
        neighborhoods={neighborhoods}
        loading={villaLoading}
      />
    </div>
  );
}

export default App;
