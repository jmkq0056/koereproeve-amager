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

export interface Route {
  index: number;
  duration_seconds: number;
  duration_minutes: number;
  distance_meters: number;
  polyline: string;
  include_motorway: boolean;
  within_target: boolean;
  legs: any[];
}

export interface VillaStreet {
  id: number;
  name: string;
  lat: number;
  lng: number;
  highway_type: string;
  geometry: LatLng[];
}

export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
  address: string;
  source: string;
}

export type MarkerFilter = {
  hojre_vigepligt: boolean;
  ubetinget_vigepligt: boolean;
  trafiklys: boolean;
  stopskilt: boolean;
  speed_limits: boolean;
};
