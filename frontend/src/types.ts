export interface LatLng {
  lat: number;
  lng: number;
}

export interface Intersection {
  id: number;
  lat: number;
  lng: number;
  type: "hojre_vigepligt" | "ubetinget_vigepligt" | "trafiklys" | "stopskilt" | "crossing";
}

export interface Road {
  id: number;
  name: string;
  maxspeed: string;
  highway_type: string;
  geometry: LatLng[];
}

export interface SavedRoute {
  id: string;
  name: string;
  duration_minutes: number;
  distance_meters: number;
  polyline: string;
  include_motorway: boolean;
  created_at: string;
}

export interface RouteData {
  duration_minutes: number;
  distance_meters: number;
  polyline: string;
  include_motorway: boolean;
  legs: any[];
}

export interface VillaStreet {
  id: number;
  name: string;
  lat: number;
  lng: number;
  highway_type: string;
  geometry: LatLng[];
  distance_m?: number;
}

export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
  address: string;
  source: string;
}

export interface Step {
  instruction: string;
  maneuver: string;
  distance_text: string;
  duration_text: string;
  polyline: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export type MarkerFilter = {
  hojre_vigepligt: boolean;
  ubetinget_vigepligt: boolean;
  trafiklys: boolean;
  stopskilt: boolean;
  speed_limits: boolean;
};

export type Screen = "home" | "map" | "streetview" | "trainer";
