"""One-time: logos for engineering colleges that only had a campus photo (files in frontend/public/logos, from
Collegedunia / Wikipedia / the college websites). Only fills an empty logo, once per database (settings flag)."""
import logging

from lib.db import db

logger = logging.getLogger(__name__)
FLAG = "college_logos_v2"
LOGOS = {
    "kjsce-mumbai": "/logos/kjsce-mumbai.png",
    "viit-pune": "/logos/viit-pune.png",
    "aissms-coe-pune": "/logos/aissms-coe-pune.jpg",
    "frcrce-mumbai": "/logos/frcrce-mumbai.png",
    "vesit-mumbai": "/logos/vesit-mumbai.png",
    "dy-patil-pune": "/logos/dy-patil-pune.png",
    "iit-delhi": "/logos/iit-delhi.png",
    "iit-madras": "/logos/iit-madras.png",
    "vjti-mumbai": "/logos/vjti-mumbai.png",
    "ict-mumbai": "/logos/ict-mumbai.png",
    "bits-pilani": "/logos/bits-pilani.png",
    "vit-vellore": "/logos/vit-vellore.png",
    "ait-pune": "/logos/ait-pune.gif",
    "sit-pune": "/logos/sit-pune.png",
    "sit-nagpur": "/logos/sit-nagpur.png",
    "iiit-raichur": "/logos/iiit-raichur.png",
    "tsec-mumbai": "/logos/tsec-mumbai.jpg",
}


async def apply_college_logos() -> None:
    try:
        if await db.settings.find_one({"key": FLAG}):
            return
        n = 0
        for slug, logo in LOGOS.items():
            r = await db.colleges.update_one({"slug": slug, "$or": [{"logo": ""}, {"logo": None}, {"logo": {"$exists": False}}]}, {"$set": {"logo": logo}})
            n += r.modified_count
        await db.settings.update_one({"key": FLAG}, {"$set": {"key": FLAG, "done": True, "updated": n}}, upsert=True)
    except Exception as exc:  # noqa: BLE001
        logger.error("College logos failed: %s", exc)
