from fastapi import APIRouter, Depends
import httpx
from config import get_settings, Settings
from db import villa_areas_col

router = APIRouter()

START_LAT = 55.6295
START_LNG = 12.6372

PLACES_API_URL = "https://places.googleapis.com/v1/places:searchNearby"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


@router.get("/areas")
async def get_villa_areas(
    lat: float = START_LAT,
    lng: float = START_LNG,
    radius: int = 3000,
    settings: Settings = Depends(get_settings),
):
    """
    Find villa kvarterer (residential neighborhoods) near the start address
    using both Google Places API and OSM Overpass.
    """
    # OSM Overpass: find residential areas tagged in Amager/Tårnby/Kastrup
    overpass_query = f"""
    [out:json][timeout:30];
    (
      way["landuse"="residential"](around:{radius},{lat},{lng});
      relation["landuse"="residential"](around:{radius},{lat},{lng});
      way["highway"="residential"](around:{radius},{lat},{lng});
    );
    out body geom;
    """

    async with httpx.AsyncClient(timeout=30) as client:
        osm_resp = await client.post(OVERPASS_URL, data={"data": overpass_query})
    osm_data = osm_resp.json()

    villa_streets = []
    seen_names = set()

    for el in osm_data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name or name in seen_names:
            continue
        seen_names.add(name)

        geometry = el.get("geometry", [])
        center_lat = sum(p["lat"] for p in geometry) / len(geometry) if geometry else lat
        center_lng = sum(p["lon"] for p in geometry) / len(geometry) if geometry else lng

        villa_streets.append({
            "id": el["id"],
            "name": name,
            "lat": center_lat,
            "lng": center_lng,
            "highway_type": tags.get("highway", ""),
            "geometry": [{"lat": p["lat"], "lng": p["lon"]} for p in geometry],
        })

    # Google Places: search for residential neighborhoods
    places_body = {
        "includedTypes": ["sublocality", "neighborhood"],
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius),
            }
        },
    }

    places_headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.G_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.location,places.formattedAddress",
    }

    neighborhoods = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            places_resp = await client.post(
                PLACES_API_URL, json=places_body, headers=places_headers
            )
            places_data = places_resp.json()

        for place in places_data.get("places", []):
            loc = place.get("location", {})
            neighborhoods.append({
                "name": place.get("displayName", {}).get("text", ""),
                "lat": loc.get("latitude"),
                "lng": loc.get("longitude"),
                "address": place.get("formattedAddress", ""),
                "source": "google_places",
            })
    except Exception:
        pass  # Google Places is supplementary, OSM is primary

    # Save to MongoDB
    all_areas = villa_streets + neighborhoods
    if all_areas:
        await villa_areas_col.delete_many({})
        await villa_areas_col.insert_many(all_areas)

    return {
        "villa_streets_count": len(villa_streets),
        "neighborhoods_count": len(neighborhoods),
        "villa_streets": villa_streets,
        "neighborhoods": neighborhoods,
    }
