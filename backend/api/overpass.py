from fastapi import APIRouter
from db import db

router = APIRouter()

speed_col = db["speed_limits"]
signed_col = db["signed_intersections"]
hojre_col = db["hojre_vigepligt"]


@router.get("/intersections")
async def get_intersections():
    """All signed intersections from MongoDB."""
    docs = await signed_col.find({}, {"_id": 0}).to_list(10000)
    return {"count": len(docs), "intersections": docs}


@router.get("/speed-limits")
async def get_speed_limits():
    """All speed limits from MongoDB."""
    docs = await speed_col.find({}, {"_id": 0}).to_list(10000)
    return {"count": len(docs), "roads": docs}


@router.get("/hojre-vigepligt")
async def get_hojre_vigepligt():
    """All højre vigepligt + signed intersections from MongoDB."""
    hojre = await hojre_col.find({}, {"_id": 0}).to_list(10000)
    signed = await signed_col.find({}, {"_id": 0}).to_list(10000)
    return {
        "hojre_vigepligt_count": len(hojre),
        "signed_count": len(signed),
        "hojre_vigepligt": hojre,
        "signed": signed,
    }


@router.post("/hojre-vigepligt/bulk-delete")
async def bulk_delete_hojre(body: dict):
    """Delete false positive højre vigepligt by osm_id list."""
    osm_ids = body.get("osm_ids", [])
    if not osm_ids:
        return {"deleted": 0}
    result = await hojre_col.delete_many({"osm_id": {"$in": osm_ids}})
    return {"deleted": result.deleted_count}
