from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings

settings = get_settings()
client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.DB_NAME]

# Collections
villa_areas_col = db["villa_areas"]
villa_col = db["villa_streets"]
hojre_col = db["hojre_vigepligt"]
routes_col = db["routes"]
google_speed_col = db["google_speed_limits"]
