"""
One-time seed script: query Overpass API locally and store results in MongoDB.
Run this once: python seed.py
"""
import httpx
import asyncio
import random
from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings

settings = get_settings()
client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.DB_NAME]

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

START_LAT = 55.634464
START_LNG = 12.650135
RADIUS = 4000

_query_count = 0


async def query_overpass(query: str, max_retries: int = 8) -> dict:
    global _query_count
    _query_count += 1

    # Polite delay between queries to avoid rate limits
    if _query_count > 1:
        await asyncio.sleep(5)

    endpoints = OVERPASS_ENDPOINTS[:]
    random.shuffle(endpoints)

    headers = {
        "User-Agent": "KoereproeveAmager/1.0 (educational driving test app)",
        "Accept": "application/json",
    }

    for attempt in range(max_retries):
        url = endpoints[attempt % len(endpoints)]
        short = url.split("//")[1].split("/")[0]
        print(f"  [{short}] attempt {attempt+1}...")
        try:
            async with httpx.AsyncClient(timeout=120, follow_redirects=True) as c:
                resp = await c.post(url, data={"data": query}, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code == 429:
                    print(f"  [{short}] rate limited, waiting 30s...")
                    await asyncio.sleep(30)
                else:
                    print(f"  [{short}] status {resp.status_code}, rotating...")
        except Exception as e:
            print(f"  [{short}] error: {type(e).__name__}, rotating...")
        wait = 5 + attempt * 3
        await asyncio.sleep(wait)

    print("  ALL endpoints exhausted after retries")
    return {"elements": []}


async def seed_speed_limits():
    print("\n=== SPEED LIMITS ===")
    query = f"""
    [out:json][timeout:60];
    (
      way["highway"]["maxspeed"](around:{RADIUS},{START_LAT},{START_LNG});
    );
    out body geom;
    """
    data = await query_overpass(query)

    roads = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        geometry = el.get("geometry", [])
        if not geometry:
            continue
        roads.append({
            "osm_id": el["id"],
            "name": tags.get("name", "Unavngivet"),
            "maxspeed": tags.get("maxspeed", "50"),
            "highway_type": tags.get("highway", ""),
            "geometry": [{"lat": p["lat"], "lng": p["lon"]} for p in geometry],
        })

    col = db["speed_limits"]
    await col.drop()
    if roads:
        await col.insert_many(roads)
    print(f"  Stored {len(roads)} roads with speed limits")
    return len(roads)


async def seed_signed_intersections():
    print("\n=== SIGNED INTERSECTIONS (trafiklys, ubetinget vigepligt, stopskilt) ===")
    query = f"""
    [out:json][timeout:60];
    (
      node["highway"="traffic_signals"](around:{RADIUS},{START_LAT},{START_LNG});
      node["highway"="give_way"](around:{RADIUS},{START_LAT},{START_LNG});
      node["highway"="stop"](around:{RADIUS},{START_LAT},{START_LNG});
    );
    out body;
    """
    data = await query_overpass(query)

    signed = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        hw = tags.get("highway", "")
        if hw == "traffic_signals":
            t = "trafiklys"
        elif hw == "give_way":
            t = "ubetinget_vigepligt"
        elif hw == "stop":
            t = "stopskilt"
        else:
            continue
        signed.append({
            "osm_id": el["id"],
            "lat": el["lat"],
            "lng": el["lon"],
            "type": t,
        })

    col = db["signed_intersections"]
    await col.drop()
    if signed:
        await col.insert_many(signed)
    print(f"  Stored {len(signed)} signed intersections")
    return {el["osm_id"] for el in signed}


async def seed_hojre_vigepligt(signed_ids: set):
    """
    Højre vigepligt ONLY deep inside villa quarters:
    - ALL roads at node are residential (nothing else)
    - No footway/cycleway/pedestrian shares any node with the connecting residential ways
    - Connecting residential ways have no sidewalk/cycleway tags
    - No signs, roundabouts, cobblestone surfaces
    """
    print("\n=== HØJRE VIGEPLIGT (villa quarter residential junctions only) ===")
    from collections import defaultdict

    # Fetch residential + nearby infra + bigger roads in one query
    query = f"""
    [out:json][timeout:120];
    (
      way["highway"~"residential|tertiary|secondary|primary|trunk|motorway|service|track|footway|cycleway|pedestrian|path|steps|living_street|unclassified"](around:{RADIUS},{START_LAT},{START_LNG});
    );
    out body;
    """
    data = await query_overpass(query)

    DISQUALIFYING_SURFACES = {"cobblestone", "paving_stones", "sett", "unhewn_cobblestone"}
    INFRA_TYPES = {"footway", "cycleway", "pedestrian", "path", "steps", "crossing"}

    # Per node: which highway types touch it, which way IDs
    node_road_types: dict[int, set] = {}
    node_way_ids: dict[int, set] = {}
    node_poison: dict[int, set] = {}

    # Per way: its node list and tags
    way_nodes: dict[int, list[int]] = {}
    residential_way_ids: set[int] = set()

    # All nodes that belong to infrastructure ways (footway/cycleway/etc.)
    infra_nodes: set[int] = set()

    for el in data.get("elements", []):
        if el["type"] != "way":
            continue
        tags = el.get("tags", {})
        hw = tags.get("highway", "")
        way_id = el["id"]
        nodes = el.get("nodes", [])
        way_nodes[way_id] = nodes
        is_roundabout = tags.get("junction", "") in ("roundabout", "circular")
        surface = tags.get("surface", "")
        sidewalk = tags.get("sidewalk", "no")
        cycleway_tag = tags.get("cycleway", "no")
        has_infra_tags = sidewalk not in ("no", "none", "") or cycleway_tag not in ("no", "none", "")

        if hw == "residential":
            residential_way_ids.add(way_id)

        # Collect all nodes on infrastructure ways
        if hw in INFRA_TYPES:
            infra_nodes.update(nodes)

        for nid in nodes:
            if nid not in node_road_types:
                node_road_types[nid] = set()
                node_way_ids[nid] = set()
                node_poison[nid] = set()
            node_road_types[nid].add(hw)
            node_way_ids[nid].add(way_id)
            if is_roundabout:
                node_poison[nid].add("roundabout")
            if surface in DISQUALIFYING_SURFACES:
                node_poison[nid].add("surface")
            if hw == "residential" and has_infra_tags:
                node_poison[nid].add("sidewalk_on_road")

    print(f"  {len(infra_nodes)} infrastructure nodes (footway/cycleway/pedestrian)")
    print(f"  {len(residential_way_ids)} residential ways")

    # For each residential way, check if ANY of its nodes is also on an infra way
    # If so, ALL nodes on that way are "tainted" — it's not a pure villa street
    tainted_way_ids: set[int] = set()
    for wid in residential_way_ids:
        nodes = way_nodes.get(wid, [])
        for nid in nodes:
            if nid in infra_nodes:
                tainted_way_ids.add(wid)
                break

    print(f"  {len(tainted_way_ids)} residential ways touch a footway/cycleway (tainted)")

    # Get node coordinates
    nodes_query = f"""
    [out:json][timeout:90];
    way["highway"="residential"](around:{RADIUS},{START_LAT},{START_LNG});
    node(w);
    out body;
    """
    nodes_data = await query_overpass(nodes_query)
    all_nodes = {el["id"]: el for el in nodes_data.get("elements", []) if el["type"] == "node"}

    # Check node-level tags
    for nid, el in all_nodes.items():
        tags = el.get("tags", {})
        node_hw = tags.get("highway", "")
        if node_hw in ("crossing", "give_way", "stop", "traffic_signals"):
            if nid not in node_poison:
                node_poison[nid] = set()
            node_poison[nid].add(f"node:{node_hw}")
        if tags.get("crossing"):
            if nid not in node_poison:
                node_poison[nid] = set()
            node_poison[nid].add("crossing")

    hojre = []
    skip_reasons = defaultdict(int)
    for nid, road_types in node_road_types.items():
        if nid not in all_nodes:
            continue
        way_ids = node_way_ids.get(nid, set())
        if len(way_ids) < 2:
            continue
        if nid in signed_ids:
            skip_reasons["signed"] += 1
            continue
        if node_poison.get(nid):
            skip_reasons["poison"] += 1
            continue
        # ALL road types at this node must be residential only
        if road_types != {"residential"}:
            skip_reasons["not_pure_residential"] += 1
            continue
        # None of the connecting residential ways should be tainted (touch infra)
        if way_ids & tainted_way_ids:
            skip_reasons["way_touches_infra"] += 1
            continue

        el = all_nodes[nid]
        hojre.append({
            "osm_id": nid,
            "lat": el["lat"],
            "lng": el["lon"],
            "type": "hojre_vigepligt",
            "way_count": len(way_ids),
        })

    col = db["hojre_vigepligt"]
    await col.drop()
    if hojre:
        await col.insert_many(hojre)
    print(f"  Stored {len(hojre)} højre vigepligt junctions (out of {len(all_nodes)} residential nodes)")
    print(f"  Skip reasons: {dict(skip_reasons)}")


def decode_here_polyline(encoded: str) -> list[tuple[float, float]]:
    """Decode HERE flexible polyline format."""
    # HERE uses a custom flexible polyline encoding
    # pip install flexpolyline handles it, but let's inline a simple decoder
    import flexpolyline
    return [(lat, lng) for lat, lng, *_ in flexpolyline.decode(encoded)]


async def seed_here_speed_limits():
    """
    One-time seed: use HERE Routing API to get speed limits across the Amager area.
    Creates routes between grid edge points through the area, collects speed limit spans.
    Stores in google_speed_limits collection (same schema for frontend compat).
    """
    print("\n=== HERE SPEED LIMITS (one-time seed) ===")
    import math

    here_key = settings.HERE_API_KEY
    if not here_key:
        print("  SKIPPED — no HERE_API_KEY in .env")
        return

    # Generate edge points around the circle for route pairs
    # Routes from various directions through the area capture all road speeds
    edge_points = []
    for angle_deg in range(0, 360, 30):  # 12 directions
        angle = math.radians(angle_deg)
        dlat = (RADIUS / 111000) * math.cos(angle)
        dlng = (RADIUS / (111000 * math.cos(math.radians(START_LAT)))) * math.sin(angle)
        edge_points.append((round(START_LAT + dlat, 6), round(START_LNG + dlng, 6)))

    # Also add the center
    center = (START_LAT, START_LNG)

    # Create route pairs: center↔edge and cross-area
    route_pairs = []
    for ep in edge_points:
        route_pairs.append((center, ep))
        route_pairs.append((ep, center))
    # Cross-area: opposite edges
    for i in range(len(edge_points) // 2):
        j = i + len(edge_points) // 2
        route_pairs.append((edge_points[i], edge_points[j]))

    print(f"  {len(route_pairs)} route pairs to query")

    all_points = []  # (lat, lng, speed_kmh)

    for idx, (origin, dest) in enumerate(route_pairs):
        url = (
            f"https://router.hereapi.com/v8/routes"
            f"?transportMode=car"
            f"&origin={origin[0]},{origin[1]}"
            f"&destination={dest[0]},{dest[1]}"
            f"&return=polyline,summary&spans=speedLimit"
            f"&apikey={here_key}"
        )

        try:
            async with httpx.AsyncClient(timeout=30) as c:
                resp = await c.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    for route in data.get("routes", []):
                        for section in route.get("sections", []):
                            polyline_str = section.get("polyline", "")
                            spans = section.get("spans", [])
                            if not polyline_str or not spans:
                                continue

                            try:
                                coords = decode_here_polyline(polyline_str)
                            except Exception:
                                continue

                            # Each span has offset (index into polyline) and speedLimit (m/s)
                            for si, span in enumerate(spans):
                                offset = span.get("offset", 0)
                                speed_ms = span.get("speedLimit", 0)
                                if not speed_ms or speed_ms <= 0:
                                    continue
                                speed_kmh = round(speed_ms * 3.6)

                                # Get coords at offset
                                if offset < len(coords):
                                    lat, lng = coords[offset]
                                    all_points.append((lat, lng, speed_kmh))

                                    # Also sample midpoint to next span for coverage
                                    next_offset = spans[si + 1]["offset"] if si + 1 < len(spans) else len(coords) - 1
                                    mid = (offset + next_offset) // 2
                                    if mid < len(coords) and mid != offset:
                                        mlat, mlng = coords[mid]
                                        all_points.append((mlat, mlng, speed_kmh))

                    print(f"  Route {idx+1}/{len(route_pairs)}: OK ({len(all_points)} total points)")
                elif resp.status_code == 429:
                    print(f"  Route {idx+1}: rate limited, waiting 30s...")
                    await asyncio.sleep(30)
                else:
                    print(f"  Route {idx+1}: status {resp.status_code}")
        except Exception as e:
            print(f"  Route {idx+1}: error {type(e).__name__}: {e}")

        # Rate limit: ~10 req/s for free tier
        await asyncio.sleep(0.2)

    # --- Phase 2: overlay OSM maxspeed data (actual mapped speed signs) ---
    # HERE misses zone 30/40 signs in villa areas and some 60 km/h roads.
    # OSM has explicit maxspeed tags from people mapping the real signs.
    print("  Fetching OSM maxspeed data for overlay...")
    osm_query = f"""
    [out:json][timeout:60];
    (
      way["highway"]["maxspeed"](around:{RADIUS},{START_LAT},{START_LNG});
    );
    out body geom;
    """
    osm_data = await query_overpass(osm_query)

    osm_points = []
    for el in osm_data.get("elements", []):
        tags = el.get("tags", {})
        maxspeed_raw = tags.get("maxspeed", "")
        # Parse: "50", "30", "60 km/h", etc.
        try:
            maxspeed = int(maxspeed_raw.split()[0])
        except (ValueError, IndexError):
            continue
        if maxspeed <= 0 or maxspeed > 150:
            continue

        geometry = el.get("geometry", [])
        if not geometry:
            continue

        # Sample every point along the road geometry
        for point in geometry:
            osm_points.append((point["lat"], point["lon"], maxspeed))

    print(f"  {len(osm_points)} OSM speed points from maxspeed tags")

    # Explicit overrides for known locations
    # Start/parking area at Vindblæs Alle 2 — parking = 20 km/h
    osm_points.append((START_LAT, START_LNG, 20))

    # --- Phase 3: merge HERE + OSM, OSM overrides HERE ---
    # First pass: HERE data
    seen = {}
    for lat, lng, speed in all_points:
        key = f"{round(lat * 2000)}_{round(lng * 2000)}"  # ~50m grid
        if key not in seen:
            seen[key] = {"lat": round(lat, 6), "lng": round(lng, 6), "speedLimit": speed, "units": "KPH", "placeId": key}

    here_count = len(seen)

    # Second pass: OSM overrides (actual mapped signs beat HERE defaults)
    osm_added = 0
    osm_overrides = 0
    for lat, lng, speed in osm_points:
        key = f"{round(lat * 2000)}_{round(lng * 2000)}"
        if key not in seen:
            seen[key] = {"lat": round(lat, 6), "lng": round(lng, 6), "speedLimit": speed, "units": "KPH", "placeId": key}
            osm_added += 1
        elif seen[key]["speedLimit"] != speed:
            seen[key]["speedLimit"] = speed
            osm_overrides += 1

    print(f"  HERE: {here_count} cells, OSM added: {osm_added}, OSM overrides: {osm_overrides}")

    unique = list(seen.values())

    col = db["google_speed_limits"]
    await col.drop()
    if unique:
        await col.insert_many(unique)
    print(f"  Stored {len(unique)} unique merged speed limit records")


async def seed_villa_streets():
    print("\n=== VILLA KVARTERER (residential streets) ===")
    query = f"""
    [out:json][timeout:60];
    (
      way["highway"="residential"](around:{RADIUS},{START_LAT},{START_LNG});
      way["highway"="living_street"](around:{RADIUS},{START_LAT},{START_LNG});
    );
    out body geom;
    """
    data = await query_overpass(query)

    streets = []
    seen_names = set()
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name or name in seen_names:
            continue
        seen_names.add(name)

        geometry = el.get("geometry", [])
        if not geometry:
            continue
        center_lat = sum(p["lat"] for p in geometry) / len(geometry)
        center_lng = sum(p["lon"] for p in geometry) / len(geometry)

        streets.append({
            "osm_id": el["id"],
            "name": name,
            "lat": center_lat,
            "lng": center_lng,
            "highway_type": tags.get("highway", ""),
            "geometry": [{"lat": p["lat"], "lng": p["lon"]} for p in geometry],
        })

    col = db["villa_streets"]
    await col.drop()
    if streets:
        await col.insert_many(streets)
    print(f"  Stored {len(streets)} unique villa streets")


async def main(only_here: bool = False, only_hojre: bool = False, only_speed: bool = False):
    print("=" * 50)
    print("SEEDING KØREPRØVE AMAGER DATABASE")
    print(f"Center: {START_LAT}, {START_LNG}")
    print(f"Radius: {RADIUS}m")
    print(f"DB: {settings.DB_NAME}")
    if only_here:
        print("MODE: HERE speed limits ONLY")
    elif only_hojre:
        print("MODE: Højre vigepligt ONLY")
    elif only_speed:
        print("MODE: ALL speed data ONLY (OSM + HERE)")
    print("=" * 50)

    if only_speed:
        # Reseed both speed collections without touching other data
        await asyncio.gather(seed_speed_limits(), seed_here_speed_limits())
    elif only_here:
        await seed_here_speed_limits()
    elif only_hojre:
        signed_ids = await seed_signed_intersections()
        await seed_hojre_vigepligt(signed_ids)
    else:
        # Run all in parallel — each hits a different mirror/API endpoint
        speed_task = asyncio.create_task(seed_speed_limits())
        signed_task = asyncio.create_task(seed_signed_intersections())
        villa_task = asyncio.create_task(seed_villa_streets())
        google_task = asyncio.create_task(seed_here_speed_limits())

        # hojre needs signed_ids, so wait for signed first then fire it
        signed_ids = await signed_task
        hojre_task = asyncio.create_task(seed_hojre_vigepligt(signed_ids))

        await asyncio.gather(speed_task, villa_task, hojre_task, google_task)

    print("\n" + "=" * 50)
    print("DONE!")
    print("=" * 50)

    client.close()


if __name__ == "__main__":
    import sys
    only_here = "--here" in sys.argv
    only_hojre = "--hojre" in sys.argv
    only_speed = "--speed" in sys.argv
    asyncio.run(main(only_here=only_here, only_hojre=only_hojre, only_speed=only_speed))
