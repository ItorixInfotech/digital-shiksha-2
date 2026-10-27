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
from lib.articles_2027 import ensure_2027_guides
from lib.college_import import run_college_import
from lib.college_enrich import run_college_enrich
from lib import razorpay
from lib.kcet import load_kcet_data
from lib.comedk import load_comedk_data
from lib.comedk_exam import ensure_comedk_exam
from lib.college_logos import apply_college_logos
from lib.karnataka_pages import setup_karnataka_pages
from routers import public, admin, predictor, cutoffs, whatsapp_admin, counsellors, seo, landing, seo_tools, export, redirects, media


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot
    cap_task = app.state.cap_task = asyncio.create_task(load_cap_data())  # official CAP cut-offs; reloads only when the data file version changes
    app.state.rollover_task = asyncio.create_task(run_year_rollover())  # one-time 2026 -> 2027 content rollover
    app.state.guides_task = asyncio.create_task(ensure_2027_guides())  # 2027 admission guides, inserted once
    app.state.fees_task = asyncio.create_task(razorpay.warm_fees())  # live Payment Page prices, fetched in parallel
    rollover_task = app.state.rollover_task

    async def comedk_exam_after_rollover() -> None:  # the rollover must not touch the COMEDK page's 2026 dates
        await rollover_task
        await ensure_comedk_exam()
    app.state.comedk_exam_task = asyncio.create_task(comedk_exam_after_rollover())

    async def colleges_chain() -> None:  # order matters: colleges -> cut-off data (maps to college pages) -> placements/cut-offs
        await run_college_import()  # MH + KA B.Tech colleges with logos, once
        await apply_college_logos()  # logos for the remaining engineering colleges, once
        await cap_task
        await load_kcet_data()  # official KEA KCET closing ranks; reloads only when the data file version changes
        await load_comedk_data()  # official COMEDK closing ranks; reloads only when the data file version changes
        await run_college_enrich()  # top new MH + KA colleges: packages + cut-offs, once
        await setup_karnataka_pages()  # Bengaluru / Mysuru / Mangaluru engineering page content, once
    app.state.college_import_task = asyncio.create_task(colleges_chain())
    app.state.redirects_task = asyncio.create_task(redirects.seed_redirects())  # starter /blog -> /news redirect, once
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
api_router.include_router(redirects.router)
api_router.include_router(media.router)

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
