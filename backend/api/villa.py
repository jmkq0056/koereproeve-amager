import math
from fastapi import APIRouter
from db import db

router = APIRouter()

villa_col = db["villa_streets"]

START_LAT = 55.634464
START_LNG = 12.650135


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in meters."""
    R = 6371000
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (math.sin(dLat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/areas")
async def get_villa_areas():
    """All villa streets from MongoDB, sorted by distance from start."""
    streets = await villa_col.find({}, {"_id": 0}).to_list(10000)

    for s in streets:
        s["distance_m"] = round(haversine(START_LAT, START_LNG, s["lat"], s["lng"]))

    streets.sort(key=lambda s: s["distance_m"])

    return {
        "villa_streets_count": len(streets),
        "neighborhoods_count": 0,
        "villa_streets": streets,
        "neighborhoods": [],
    }
