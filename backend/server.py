import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.cap import load_cap_data
from lib.db import client, ensure_indexes
from lib.year_rollover import run_year_rollover
from routers import public, admin, predictor, cutoffs, whatsapp_admin, counsellors, seo, landing, seo_tools, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot
    app.state.cap_task = asyncio.create_task(load_cap_data())
    app.state.rollover_task = asyncio.create_task(run_year_rollover())  # one-time 2026 -> 2027 content rollover  # official CAP cut-offs; reloads only when the data file version changes
    yield
    client.close()


app = FastAPI(lifespan=lifespan, title="Digital Shiksha API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Digital Shiksha API"}


api_router.include_router(public.router)
api_router.include_router(admin.router)
api_router.include_router(predictor.router)
api_router.include_router(cutoffs.router)
api_router.include_router(whatsapp_admin.router)
api_router.include_router(counsellors.router)
api_router.include_router(seo.router)
api_router.include_router(landing.router)
api_router.include_router(seo_tools.router)
api_router.include_router(export.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Liveness/readiness probes hit the container root (not /api), so this one route lives on `app`.
@app.get("/health")
async def health():
    return {"status": "ok"}


@api_router.get("/health")
async def api_health():
    return {"status": "ok"}


# Include the router in the main app — keep this the last statement
app.include_router(api_router)
