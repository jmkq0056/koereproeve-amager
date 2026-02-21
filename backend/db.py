from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings

settings = get_settings()
client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.DB_NAME]

# Collections
villa_areas_col = db["villa_areas"]
routes_col = db["routes"]
