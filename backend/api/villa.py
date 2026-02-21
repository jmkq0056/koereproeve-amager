from fastapi import APIRouter
from db import db

router = APIRouter()

villa_col = db["villa_streets"]


@router.get("/areas")
async def get_villa_areas():
    """All villa streets from MongoDB."""
    streets = await villa_col.find({}, {"_id": 0}).to_list(10000)
    return {
        "villa_streets_count": len(streets),
        "neighborhoods_count": 0,
        "villa_streets": streets,
        "neighborhoods": [],
    }
