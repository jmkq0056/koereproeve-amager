from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from api.routes import router as routes_router
from api.villa import router as villa_router
from api.overpass import router as overpass_router

settings = get_settings()

app = FastAPI(title="Køreprøve Amager API")

allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_router, prefix="/api/routes", tags=["routes"])
app.include_router(villa_router, prefix="/api/villa", tags=["villa"])
app.include_router(overpass_router, prefix="/api/overpass", tags=["overpass"])


@app.get("/health")
async def health():
    return {"status": "ok"}
