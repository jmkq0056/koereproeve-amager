import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: `${BASE}/api` });

export async function fetchRoute(includeMotorway: boolean) {
  const { data } = await api.get("/routes/generate", {
    params: { include_motorway: includeMotorway },
  });
  return data;
}

export async function fetchSavedRoutes() {
  const { data } = await api.get("/routes/saved");
  return data;
}

export async function fetchIntersections(lat?: number, lng?: number, radius?: number) {
  const { data } = await api.get("/overpass/intersections", {
    params: { lat, lng, radius },
  });
  return data;
}

export async function fetchSpeedLimits(lat?: number, lng?: number, radius?: number) {
  const { data } = await api.get("/overpass/speed-limits", {
    params: { lat, lng, radius },
  });
  return data;
}

export async function fetchHojreVigepligt(lat?: number, lng?: number, radius?: number) {
  const { data } = await api.get("/overpass/hojre-vigepligt", {
    params: { lat, lng, radius },
  });
  return data;
}

export async function fetchVillaAreas(lat?: number, lng?: number, radius?: number) {
  const { data } = await api.get("/villa/areas", {
    params: { lat, lng, radius },
  });
  return data;
}
