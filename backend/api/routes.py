from fastapi import APIRouter, Depends
import httpx
from config import get_settings, Settings
from db import routes_col

router = APIRouter()

START_ADDRESS = "Amager Strandvej 390, 2770 Kastrup, Denmark"
START_LAT = 55.6295
START_LNG = 12.6372

TAARNBY_RUNDKOERSEL = {"lat": 55.6180, "lng": 12.6050}
MOTORWAY_ONRAMP = {"lat": 55.6250, "lng": 12.6200}

ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


@router.get("/generate")
async def generate_route(
    include_motorway: bool = True,
    settings: Settings = Depends(get_settings),
):
    """
    Generate a driving test route (loop) from start address.
    With or without motorway section.
    Target: 25-35 min round trip.
    """
    waypoints = []

    if include_motorway:
        waypoints = [
            MOTORWAY_ONRAMP,
            TAARNBY_RUNDKOERSEL,
        ]

    intermediate = [
        {
            "intermediateWaypoint": {
                "location": {
                    "latLng": {"latitude": wp["lat"], "longitude": wp["lng"]}
                }
            }
        }
        for wp in waypoints
    ]

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
        "intermediates": [item["intermediateWaypoint"] for item in intermediate] if intermediate else [],
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "routeModifiers": {
            "avoidHighways": not include_motorway,
        },
        "computeAlternativeRoutes": True,
        "languageCode": "da",
        "units": "METRIC",
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.G_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline",
    }

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
