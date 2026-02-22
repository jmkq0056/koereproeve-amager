import random
import math
from fastapi import APIRouter, Depends
import httpx
from config import get_settings, Settings
from db import routes_col, villa_col, hojre_col

router = APIRouter()

START_ADDRESS = "Vindblæs Alle 2, 2770 Kastrup, Denmark"
START_LAT = 55.634464
START_LNG = 12.650135

TAARNBY_RUNDKOERSEL = {"lat": 55.6180, "lng": 12.6050}
# E20 motorway waypoints — exact OSM node coordinates
# Route: Start(Kastrup) → villa → E20 east → westbound through tunnel → Tårnby → villa → Start
# Entry near Kastrup (OSM node 118900, non-toll section)
MOTORWAY_EAST = {"lat": 55.6302, "lng": 12.6351}
# Tårnby tunnel midpoint — ONLY motorway here, no parallel surface roads
MOTORWAY_TUNNEL = {"lat": 55.6294, "lng": 12.6046}

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
        # villa → E20 east entry → westbound through tunnel → Tårnby rundkørsel → villa → back
        pre = await pick_spread_waypoints(1)
        post = await pick_spread_waypoints(1)
        villa_wps = pre + post
        motorway_wps = [MOTORWAY_EAST, MOTORWAY_TUNNEL, TAARNBY_RUNDKOERSEL]
        waypoints = pre + [MOTORWAY_EAST, MOTORWAY_TUNNEL, TAARNBY_RUNDKOERSEL] + post
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

    body = {
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
        "routeModifiers": {
            "avoidHighways": not include_motorway,
        },
        "computeAlternativeRoutes": False,
        "languageCode": "da",
        "units": "METRIC",
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.G_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.localizedValues,routes.legs.steps.polyline,routes.legs.steps.speedReadingIntervals,routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline",
    }

    max_retries = 3 if include_motorway else 1
    routes = []

    for attempt in range(max_retries):
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(ROUTES_API_URL, json=body, headers=headers)
            data = resp.json()

        routes = []
        for i, route in enumerate(data.get("routes", [])):
            duration_str = route.get("duration", "0s")
            duration_seconds = int(duration_str.replace("s", ""))
            duration_minutes = duration_seconds / 60

            routes.append({
                "index": i,
                "duration_seconds": duration_seconds,
                "duration_minutes": round(duration_minutes, 1),
                "distance_meters": route.get("distanceMeters", 0),
                "polyline": route.get("polyline", {}).get("encodedPolyline", ""),
                "legs": route.get("legs", []),
                "include_motorway": include_motorway,
                "within_target": 25 <= duration_minutes <= 40,
            })

        # Motorway validation: check navigation instructions mention motorway
        if include_motorway and routes:
            has_motorway = False
            for route in routes:
                for leg in route.get("legs", []):
                    for step in leg.get("steps", []):
                        nav = step.get("navigationInstruction", {})
                        instr = (nav.get("instructions", "") or "").lower()
                        if any(kw in instr for kw in ["motorvej", "e20", "e 20", "motorway"]):
                            has_motorway = True
                            break
                    if has_motorway:
                        break
                if has_motorway:
                    break
            if has_motorway:
                break
            # Retry with different villa waypoints
            if attempt < max_retries - 1:
                pre = await pick_spread_waypoints(1)
                post = await pick_spread_waypoints(1)
                waypoints = pre + [MOTORWAY_EAST, MOTORWAY_TUNNEL, TAARNBY_RUNDKOERSEL] + post
                intermediate = []
                for wp in waypoints:
                    entry = {"location": {"latLng": {"latitude": wp["lat"], "longitude": wp["lng"]}}}
                    if wp in [MOTORWAY_EAST, MOTORWAY_TUNNEL, TAARNBY_RUNDKOERSEL]:
                        entry["via"] = True
                    intermediate.append(entry)
                body["intermediates"] = intermediate
        else:
            break

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
