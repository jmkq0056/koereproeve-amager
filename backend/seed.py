"""
One-time seed script: query Overpass API locally and store results in MongoDB.
Run this once: python seed.py
"""
import httpx
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings

settings = get_settings()
client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.DB_NAME]

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
START_LAT = 55.6295
START_LNG = 12.6372
RADIUS = 4000  # 4km covers all of Tårnby/Kastrup driving test area


async def query_overpass(query: str) -> dict:
    print(f"  Querying Overpass...")
    async with httpx.AsyncClient(timeout=120) as c:
        resp = await c.post(OVERPASS_URL, data={"data": query})
        if resp.status_code != 200:
            print(f"  ERROR: status {resp.status_code}")
            print(f"  {resp.text[:500]}")
            return {"elements": []}
        return resp.json()


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
    print("\n=== HØJRE VIGEPLIGT (residential junctions without signs) ===")
    # Get all nodes on residential roads
    query = f"""
    [out:json][timeout:60];
    way["highway"~"residential|living_street|unclassified"](around:{RADIUS},{START_LAT},{START_LNG});
    node(w);
    out body;
    """
    data = await query_overpass(query)

    # Also get the ways to find actual junctions (nodes shared by multiple ways)
    ways_query = f"""
    [out:json][timeout:60];
    way["highway"~"residential|living_street|unclassified|tertiary|secondary|primary"](around:{RADIUS},{START_LAT},{START_LNG});
    out body;
    """

    print("  Getting ways for junction detection...")
    ways_data = await query_overpass(ways_query)

    # Count how many ways reference each node
    node_way_count: dict[int, int] = {}
    for way in ways_data.get("elements", []):
        for nid in way.get("nodes", []):
            node_way_count[nid] = node_way_count.get(nid, 0) + 1

    # A junction = node referenced by 2+ ways, NOT signed
    all_nodes = {el["id"]: el for el in data.get("elements", [])}
    hojre = []
    for nid, count in node_way_count.items():
        if count >= 2 and nid not in signed_ids and nid in all_nodes:
            el = all_nodes[nid]
            hojre.append({
                "osm_id": nid,
                "lat": el["lat"],
                "lng": el["lon"],
                "type": "hojre_vigepligt",
                "way_count": count,
            })

    col = db["hojre_vigepligt"]
    await col.drop()
    if hojre:
        await col.insert_many(hojre)
    print(f"  Stored {len(hojre)} højre vigepligt junctions (out of {len(all_nodes)} total nodes)")


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

    await seed_speed_limits()

    # Small delay to avoid Overpass rate limiting
    print("\n  Waiting 5s to avoid rate limit...")
    await asyncio.sleep(5)

    signed_ids = await seed_signed_intersections()

    print("\n  Waiting 5s...")
    await asyncio.sleep(5)

    await seed_hojre_vigepligt(signed_ids)

    print("\n  Waiting 5s...")
    await asyncio.sleep(5)

    await seed_villa_streets()

    print("\n" + "=" * 50)
    print("DONE! All data stored in MongoDB.")
    print("=" * 50)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
