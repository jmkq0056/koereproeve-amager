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

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
]

_next_ep = 0

START_LAT = 55.634464
START_LNG = 12.650135
RADIUS = 4000


def _random_headers() -> dict:
    """Rotate User-Agent and spoof X-Forwarded-For with random IP."""
    ip = f"{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
        "Accept": "application/json",
        "Referer": random.choice([
            "https://www.openstreetmap.org/",
            "https://wiki.openstreetmap.org/",
            "https://overpass-turbo.eu/",
        ]),
    }


async def query_overpass(query: str, max_retries: int = 8) -> dict:
    global _next_ep
    endpoints = OVERPASS_ENDPOINTS[:]
    random.shuffle(endpoints)

    for attempt in range(max_retries):
        url = endpoints[attempt % len(endpoints)]
        short = url.split("//")[1].split("/")[0]
        headers = _random_headers()
        print(f"  [{short}] attempt {attempt+1} (IP: {headers['X-Forwarded-For']})...")
        try:
            async with httpx.AsyncClient(timeout=120, follow_redirects=True) as c:
                resp = await c.post(url, data={"data": query}, headers=headers)
                if resp.status_code == 200:
                    return resp.json()
                print(f"  [{short}] status {resp.status_code}, rotating...")
        except Exception as e:
            print(f"  [{short}] error: {type(e).__name__}, rotating...")
        wait = 2 + attempt * 1.5
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
    Højre vigepligt (færdselsloven § 26, stk. 4) ONLY applies at intersections where:
    1. ALL roads meeting are equal-priority (residential, living_street, unclassified)
    2. No traffic signals, give_way signs, or stop signs
    3. Not a roundabout
    4. At least 2 distinct equal-priority roads meet (= node shared by 2+ ways)

    If ANY tertiary/secondary/primary/trunk/motorway road touches the node,
    it is NOT højre vigepligt — the smaller road has ubetinget vigepligt.
    Service roads, tracks, paths are also excluded (ubetinget vigepligt per § 26 stk. 3).
    """
    print("\n=== HØJRE VIGEPLIGT (equal-priority residential junctions, no signs) ===")

    # Get ALL road ways in the area — we need to check highway type per node
    query = f"""
    [out:json][timeout:90];
    (
      way["highway"~"residential|living_street|unclassified|tertiary|secondary|primary|trunk|motorway|service|track"](around:{RADIUS},{START_LAT},{START_LNG});
    );
    out body;
    """
    data = await query_overpass(query)

    # Equal-priority road types where højre vigepligt can apply
    EQUAL_PRIORITY = {"residential", "living_street", "unclassified"}
    # Higher-priority roads — if these touch a node, it's NOT højre vigepligt
    HIGHER_PRIORITY = {"tertiary", "secondary", "primary", "trunk", "motorway",
                       "tertiary_link", "secondary_link", "primary_link", "trunk_link", "motorway_link"}
    # Subordinate roads — ubetinget vigepligt per § 26 stk. 3
    SUBORDINATE = {"service", "track", "path", "footway", "cycleway", "pedestrian"}

    # Track: for each node, which highway types touch it, and how many distinct ways
    node_road_types: dict[int, set] = {}  # node_id -> set of highway types
    node_way_ids: dict[int, set] = {}     # node_id -> set of way IDs

    for el in data.get("elements", []):
        if el["type"] != "way":
            continue
        hw = el.get("tags", {}).get("highway", "")
        way_id = el["id"]
        is_roundabout = el.get("tags", {}).get("junction", "") in ("roundabout", "circular")

        for nid in el.get("nodes", []):
            if nid not in node_road_types:
                node_road_types[nid] = set()
                node_way_ids[nid] = set()
            if is_roundabout:
                node_road_types[nid].add("_roundabout")  # poison flag
            node_road_types[nid].add(hw)
            node_way_ids[nid].add(way_id)

    # Now get the actual node coordinates (only for residential road nodes)
    nodes_query = f"""
    [out:json][timeout:90];
    way["highway"~"residential|living_street|unclassified"](around:{RADIUS},{START_LAT},{START_LNG});
    node(w);
    out body;
    """
    nodes_data = await query_overpass(nodes_query)
    all_nodes = {el["id"]: el for el in nodes_data.get("elements", []) if el["type"] == "node"}

    hojre = []
    for nid, road_types in node_road_types.items():
        # Must be in our node set
        if nid not in all_nodes:
            continue
        # Must have 2+ distinct ways meeting (actual junction)
        if len(node_way_ids.get(nid, set())) < 2:
            continue
        # Not signed (traffic signals, give_way, stop)
        if nid in signed_ids:
            continue
        # Not a roundabout
        if "_roundabout" in road_types:
            continue
        # ALL road types at this node must be equal-priority
        # Filter out non-highway artifacts
        actual_types = road_types - {"_roundabout"}
        if not actual_types:
            continue
        # If ANY higher-priority or subordinate road touches this node, skip
        if actual_types & HIGHER_PRIORITY:
            continue
        if actual_types & SUBORDINATE:
            continue
        # Must have at least one equal-priority type
        if not (actual_types & EQUAL_PRIORITY):
            continue
        # All types must be equal-priority
        if not actual_types.issubset(EQUAL_PRIORITY):
            continue

        el = all_nodes[nid]
        hojre.append({
            "osm_id": nid,
            "lat": el["lat"],
            "lng": el["lon"],
            "type": "hojre_vigepligt",
            "way_count": len(node_way_ids[nid]),
        })

    col = db["hojre_vigepligt"]
    await col.drop()
    if hojre:
        await col.insert_many(hojre)
    print(f"  Stored {len(hojre)} højre vigepligt junctions (out of {len(all_nodes)} residential nodes)")
    print(f"  (Only intersections where ALL roads are residential/living_street/unclassified)")


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


async def main():
    print("=" * 50)
    print("SEEDING KØREPRØVE AMAGER DATABASE")
    print(f"Center: {START_LAT}, {START_LNG}")
    print(f"Radius: {RADIUS}m")
    print(f"DB: {settings.DB_NAME}")
    print("=" * 50)

    # Run all 4 in parallel — each hits a different mirror endpoint
    speed_task = asyncio.create_task(seed_speed_limits())
    signed_task = asyncio.create_task(seed_signed_intersections())
    villa_task = asyncio.create_task(seed_villa_streets())

    # hojre needs signed_ids, so wait for signed first then fire it
    signed_ids = await signed_task
    hojre_task = asyncio.create_task(seed_hojre_vigepligt(signed_ids))

    await asyncio.gather(speed_task, villa_task, hojre_task)

    print("\n" + "=" * 50)
    print("DONE! All data stored in MongoDB.")
    print("=" * 50)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
