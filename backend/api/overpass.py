from fastapi import APIRouter
import httpx

router = APIRouter()

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Start/end point: Amager Strandvej 390, 2770 Kastrup
START_LAT = 55.6295
START_LNG = 12.6372


@router.get("/intersections")
async def get_intersections(
    lat: float = START_LAT,
    lng: float = START_LNG,
    radius: int = 3000,
):
    """
    Get all intersections within radius and classify them:
    - traffic_signals (trafiklys)
    - give_way (ubetinget vigepligt / hajtænder)
    - stop (stopskilt)
    - none (højre vigepligt - no signs)
    """
    query = f"""
    [out:json][timeout:30];
    (
      // All highway junctions/crossings in the area
      node["highway"="traffic_signals"](around:{radius},{lat},{lng});
      node["highway"="give_way"](around:{radius},{lat},{lng});
      node["highway"="stop"](around:{radius},{lat},{lng});
      node["highway"="crossing"](around:{radius},{lat},{lng});
    );
    out body;
    """

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        data = resp.json()

    intersections = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        hw = tags.get("highway", "")

        if hw == "traffic_signals":
            intersection_type = "trafiklys"
        elif hw == "give_way":
            intersection_type = "ubetinget_vigepligt"
        elif hw == "stop":
            intersection_type = "stopskilt"
        else:
            intersection_type = "crossing"

        intersections.append({
            "id": el["id"],
            "lat": el["lat"],
            "lng": el["lon"],
            "type": intersection_type,
            "tags": tags,
        })

    return {"count": len(intersections), "intersections": intersections}


@router.get("/speed-limits")
async def get_speed_limits(
    lat: float = START_LAT,
    lng: float = START_LNG,
    radius: int = 3000,
):
    """
    Get speed limits for all roads in the area from OSM.
    """
    query = f"""
    [out:json][timeout:30];
    (
      way["highway"]["maxspeed"](around:{radius},{lat},{lng});
    );
    out body geom;
    """

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        data = resp.json()

    roads = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        geometry = el.get("geometry", [])

        roads.append({
            "id": el["id"],
            "name": tags.get("name", "Unnamed"),
            "maxspeed": tags.get("maxspeed", "unknown"),
            "highway_type": tags.get("highway", ""),
            "geometry": [{"lat": p["lat"], "lng": p["lon"]} for p in geometry],
        })

    return {"count": len(roads), "roads": roads}


@router.get("/hojre-vigepligt")
async def get_hojre_vigepligt(
    lat: float = START_LAT,
    lng: float = START_LNG,
    radius: int = 3000,
):
    """
    Find intersections that have HØJRE VIGEPLIGT.
    Logic: intersections in residential/villa areas where there are NO traffic signs.
    We get all road junctions in residential areas, then subtract those with signs.
    """
    # Step 1: Get ALL junctions in residential areas
    junction_query = f"""
    [out:json][timeout:30];
    (
      way["highway"~"residential|living_street|unclassified"](around:{radius},{lat},{lng});
    );
    node(w)->.all_nodes;
    // Find nodes that are shared by multiple ways (= junctions)
    way["highway"](around:{radius},{lat},{lng});
    node(w)->.highway_nodes;
    node.all_nodes.highway_nodes;
    out body;
    """

    # Step 2: Get all signed intersections
    signed_query = f"""
    [out:json][timeout:30];
    (
      node["highway"="traffic_signals"](around:{radius},{lat},{lng});
      node["highway"="give_way"](around:{radius},{lat},{lng});
      node["highway"="stop"](around:{radius},{lat},{lng});
    );
    out body;
    """

    async with httpx.AsyncClient(timeout=30) as client:
        junctions_resp = await client.post(OVERPASS_URL, data={"data": junction_query})
        signed_resp = await client.post(OVERPASS_URL, data={"data": signed_query})

    junctions_data = junctions_resp.json()
    signed_data = signed_resp.json()

    signed_ids = {el["id"] for el in signed_data.get("elements", [])}

    # Junctions NOT in signed = højre vigepligt
    hojre_vigepligt = []
    for el in junctions_data.get("elements", []):
        if el["id"] not in signed_ids:
            hojre_vigepligt.append({
                "id": el["id"],
                "lat": el["lat"],
                "lng": el["lon"],
                "type": "hojre_vigepligt",
            })

    # Also return signed ones for context
    signed = []
    for el in signed_data.get("elements", []):
        tags = el.get("tags", {})
        hw = tags.get("highway", "")
        if hw == "traffic_signals":
            t = "trafiklys"
        elif hw == "give_way":
            t = "ubetinget_vigepligt"
        elif hw == "stop":
            t = "stopskilt"
        else:
            t = "unknown"
        signed.append({
            "id": el["id"],
            "lat": el["lat"],
            "lng": el["lon"],
            "type": t,
        })

    return {
        "hojre_vigepligt_count": len(hojre_vigepligt),
        "signed_count": len(signed),
        "hojre_vigepligt": hojre_vigepligt,
        "signed": signed,
    }
