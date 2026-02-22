import random
import math
import logging
from fastapi import APIRouter, Depends
import httpx
from config import get_settings, Settings
from db import routes_col, villa_col, hojre_col

logger = logging.getLogger(__name__)

router = APIRouter()

START_ADDRESS = "Vindblæs Alle 2, 2770 Kastrup, Denmark"
START_LAT = 55.634464
START_LNG = 12.650135

# E20 motorway waypoints — real driving test checkpoints
# Always exit at the same west off-ramp
MOTORWAY_EXIT = {"lat": 55.629318, "lng": 12.603788}
# Two route variations (east → west along E20)
MOTORWAY_ROUTE_A = [
    {"lat": 55.633517, "lng": 12.656518},   # entry east
    {"lat": 55.630170, "lng": 12.641366},   # mid checkpoint
    MOTORWAY_EXIT,                            # exit west
]
MOTORWAY_ROUTE_B = [
    {"lat": 55.630433, "lng": 12.655834},   # entry east
    {"lat": 55.630201, "lng": 12.628568},   # mid checkpoint
    MOTORWAY_EXIT,                            # exit west
]

ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in meters between two points."""
    R = 6371000
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (math.sin(dLat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """Decode a Google encoded polyline into list of (lat, lng) tuples."""
    points = []
    index = 0
    lat = 0
    lng = 0
    while index < len(encoded):
        for is_lng in (False, True):
            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += delta
            else:
                lat += delta
        points.append((lat / 1e5, lng / 1e5))
    return points


def polyline_passes_near(encoded: str, target_lat: float, target_lng: float, max_dist_m: float = 500) -> bool:
    """Check if any point on a decoded polyline is within max_dist_m of target."""
    for plat, plng in decode_polyline(encoded):
        if haversine(plat, plng, target_lat, target_lng) < max_dist_m:
            return True
    return False


async def pick_spread_waypoints(count: int, min_dist_between: float = 300, max_dist_from_start: float = 2000) -> list[dict]:
    """
    Select villa waypoints, prioritizing villas near højre vigepligt junctions.
    Villas with more H junctions within 300m get picked more often.
    """
    all_villas = await villa_col.find({}, {"_id": 0, "lat": 1, "lng": 1, "name": 1}).to_list(10000)
    if not all_villas:
        return []

    hojre_junctions = await hojre_col.find({}, {"_id": 0, "lat": 1, "lng": 1}).to_list(10000)

    # Only consider villas within range of start
    nearby = [v for v in all_villas
              if 200 < haversine(v["lat"], v["lng"], START_LAT, START_LNG) < max_dist_from_start]

    # Score each villa by number of H junctions within 300m
    for v in nearby:
        h_count = sum(1 for h in hojre_junctions
                      if haversine(v["lat"], v["lng"], h["lat"], h["lng"]) < 300)
        # Weight: villas with H junctions get 5x more likely per junction
        v["_weight"] = 1 + h_count * 5

    # Weighted shuffle: higher weight = more likely to appear early
    for v in nearby:
        v["_sort"] = random.random() ** (1.0 / v["_weight"])
    nearby.sort(key=lambda v: v["_sort"], reverse=True)

    selected: list[dict] = []
    for v in nearby:
        if len(selected) >= count:
            break
        too_close = any(
            haversine(v["lat"], v["lng"], s["lat"], s["lng"]) < min_dist_between
            for s in selected
        )
        if not too_close:
            selected.append({"lat": v["lat"], "lng": v["lng"]})

    return selected


@router.get("/generate")
async def generate_route(
    include_motorway: bool = True,
    settings: Settings = Depends(get_settings),
):
    """
    Generate a driving test route (loop) from start address.
    With or without motorway section.
    Routes vary each time via random villa waypoints.
    Target: 25-35 min round trip.
    """
    if include_motorway:
        # villa → E20 (east→west) → villa → back
        # Randomly pick one of two real driving test motorway routes
        pre = await pick_spread_waypoints(1)
        post = await pick_spread_waypoints(1)
        villa_wps = pre + post
        motorway_wps = random.choice([MOTORWAY_ROUTE_A, MOTORWAY_ROUTE_B])
        waypoints = pre + motorway_wps + post
    else:
        # 3 random villa waypoints creating a residential loop
        villa_wps = await pick_spread_waypoints(3)
        motorway_wps = []
        waypoints = villa_wps

    intermediate = []
    for wp in waypoints:
        entry: dict = {
            "location": {
                "latLng": {"latitude": wp["lat"], "longitude": wp["lng"]}
            }
        }
        # Motorway waypoints are pass-through (via), not stops
        if wp in motorway_wps:
            entry["via"] = True
        intermediate.append(entry)

    body: dict = {
        "origin": {
            "location": {
                "latLng": {"latitude": START_LAT, "longitude": START_LNG}
            }
        },
        "destination": {
            "location": {
                "latLng": {"latitude": START_LAT, "longitude": START_LNG}
            }
        },
        "intermediates": intermediate,
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": False,
        "languageCode": "da",
        "units": "METRIC",
    }

    # Only set routeModifiers when we need to AVOID highways.
    # When including motorway, omit routeModifiers entirely so the via
    # waypoints on the E20 are the only routing constraint.
    if not include_motorway:
        body["routeModifiers"] = {"avoidHighways": True}

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.G_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.localizedValues,routes.legs.steps.polyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(ROUTES_API_URL, json=body, headers=headers)
        data = resp.json()

    # Handle Google API errors explicitly
    if resp.status_code != 200 or "error" in data:
        error_detail = data.get("error", {})
        error_msg = error_detail.get("message", f"HTTP {resp.status_code}")
        logger.error("Google Routes API error: %s (body: %s)", error_msg, data)
        return {
            "start": START_ADDRESS,
            "include_motorway": include_motorway,
            "routes_count": 0,
            "routes": [],
            "error": f"Google API: {error_msg}",
        }

    routes = []
    for i, route in enumerate(data.get("routes", [])):
        duration_str = route.get("duration", "0s")
        duration_seconds = int(duration_str.replace("s", ""))
        duration_minutes = duration_seconds / 60

        polyline_enc = route.get("polyline", {}).get("encodedPolyline", "")

        routes.append({
            "index": i,
            "duration_seconds": duration_seconds,
            "duration_minutes": round(duration_minutes, 1),
            "distance_meters": route.get("distanceMeters", 0),
            "polyline": polyline_enc,
            "legs": route.get("legs", []),
            "include_motorway": include_motorway,
            "within_target": 25 <= duration_minutes <= 40,
        })

    # Diagnostic: verify the polyline actually passes near the motorway exit
    if include_motorway and routes:
        poly = routes[0].get("polyline", "")
        if poly:
            near_exit = polyline_passes_near(poly, MOTORWAY_EXIT["lat"], MOTORWAY_EXIT["lng"], 500)
            logger.info("Motorway check: near_exit=%s", near_exit)
            if not near_exit:
                logger.warning("Route polyline does NOT pass near motorway exit!")

    # Save to MongoDB
    if routes:
        await routes_col.insert_many([{**r, "type": "generated"} for r in routes])

    return {
        "start": START_ADDRESS,
        "include_motorway": include_motorway,
        "routes_count": len(routes),
        "routes": routes,
    }


@router.get("/saved")
async def get_saved_routes():
    """Get all previously saved routes."""
    routes = await routes_col.find({}, {"_id": 0}).to_list(100)
    return {"count": len(routes), "routes": routes}
