import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import get_settings
from api.routes import router as routes_router
from api.villa import router as villa_router
from api.overpass import router as overpass_router

settings = get_settings()

app = FastAPI(title="Køreprøve Amager API")

allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8080",
    "capacitor://localhost",
    "ionic://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"ERROR on {request.url}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "detail": tb},
    )


from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os

@app.get("/verify")
async def verify_tool():
    path = os.path.join(os.path.dirname(__file__), "..", "tools", "verify_hojre.html")
    return FileResponse(os.path.abspath(path), media_type="text/html")

@app.get("/orientation")
async def orientation_app():
    path = os.path.join(os.path.dirname(__file__), "static", "orientation", "index.html")
    return FileResponse(os.path.abspath(path), media_type="text/html")

# Serve orientation assets (mirror images etc.)
_orient_assets = os.path.join(os.path.dirname(__file__), "static", "orientation", "assets")
if os.path.isdir(_orient_assets):
    app.mount("/assets", StaticFiles(directory=_orient_assets), name="orientation-assets")

app.include_router(routes_router, prefix="/api/routes", tags=["routes"])
app.include_router(villa_router, prefix="/api/villa", tags=["villa"])
app.include_router(overpass_router, prefix="/api/overpass", tags=["overpass"])


@app.get("/health")
async def health():
    return {"status": "ok"}
