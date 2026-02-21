"""Seed the remaining collections that got rate limited."""
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
RADIUS = 4000


async def query_overpass(query: str) -> dict:
    print(f"  Querying Overpass...")
    async with httpx.AsyncClient(timeout=120) as c:
        resp = await c.post(OVERPASS_URL, data={"data": query})
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  {resp.text[:300]}")
            return {"elements": []}
        return resp.json()


async def main():
    # Get signed IDs from DB
    signed_col = db["signed_intersections"]
    signed_docs = await signed_col.find({}, {"osm_id": 1}).to_list(10000)
    signed_ids = {d["osm_id"] for d in signed_docs}
    print(f"Loaded {len(signed_ids)} signed intersection IDs from DB")

    # HØJRE VIGEPLIGT
    print("\n=== HØJRE VIGEPLIGT ===")
    junction_query = f"""
    [out:json][timeout:60];
    way["highway"~"residential|living_street|unclassified"](around:{RADIUS},{START_LAT},{START_LNG});
    node(w);
    out body;
    """
    junctions = await query_overpass(junction_query)
    all_nodes = {el["id"]: el for el in junctions.get("elements", [])}
    print(f"  Got {len(all_nodes)} residential nodes")

    print("  Waiting 10s...")
    await asyncio.sleep(10)

    ways_query = f"""
    [out:json][timeout:60];
    way["highway"~"residential|living_street|unclassified|tertiary|secondary|primary"](around:{RADIUS},{START_LAT},{START_LNG});
    out body;
    """
    ways_data = await query_overpass(ways_query)

    node_way_count: dict[int, int] = {}
    for way in ways_data.get("elements", []):
        for nid in way.get("nodes", []):
            node_way_count[nid] = node_way_count.get(nid, 0) + 1

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
    print(f"  Stored {len(hojre)} højre vigepligt junctions")

    print("  Waiting 10s...")
    await asyncio.sleep(10)

    # VILLA STREETS
    print("\n=== VILLA KVARTERER ===")
    villa_query = f"""
    [out:json][timeout:60];
    (
      way["highway"="residential"](around:{RADIUS},{START_LAT},{START_LNG});
      way["highway"="living_street"](around:{RADIUS},{START_LAT},{START_LNG});
    );
    out body geom;
    """
    data = await query_overpass(villa_query)

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
    print(f"  Stored {len(streets)} villa streets")

    print("\nDONE!")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
