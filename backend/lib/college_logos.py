"""One-time: logos for every college that only had a campus photo (files in frontend/public/logos, from
Collegedunia / Wikipedia / the college websites). Only fills an empty logo, once per database (settings flag)."""
import logging

from lib.db import db

logger = logging.getLogger(__name__)
FLAG = "college_logos_v3"
# Banner-style logos replaced by square emblems: overwrite these even when a logo is set.
REPLACE = {"aissms-coe-pune", "vesit-mumbai", "dy-patil-pune"}
LOGOS = {
    "kjsce-mumbai": "/logos/kjsce-mumbai.png",
    "viit-pune": "/logos/viit-pune.png",
    "aissms-coe-pune": "/logos/aissms-coe-pune.png",
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
    "ihm-mumbai": "/logos/ihm-mumbai.png",
    "gsmc-kem-mumbai": "/logos/gsmc-kem-mumbai.png",
    "iim-ahmedabad": "/logos/iim-ahmedabad.png",
    "iim-bangalore": "/logos/iim-bangalore.png",
    "sibm-pune": "/logos/sibm-pune.png",
    "ils-law-pune": "/logos/ils-law-pune.png",
    "fergusson-pune": "/logos/fergusson-pune.jpg",
    "jbims-mumbai": "/logos/jbims-mumbai.png",
    "nlsiu-bangalore": "/logos/nlsiu-bangalore.png",
    "srcc-delhi": "/logos/srcc-delhi.png",
    "cmc-vellore": "/logos/cmc-vellore.png",
    "afmc-pune": "/logos/afmc-pune.png",
    "bvdu-medical-pune": "/logos/bvdu-medical-pune.png",
    "smcw-pune": "/logos/smcw-pune.png",
    "scmhrd-pune": "/logos/scmhrd-pune.png",
    "pumba-pune": "/logos/pumba-pune.png",
    "ltmmc-sion-mumbai": "/logos/ltmmc-sion-mumbai.jpg",
    "simsree-mumbai": "/logos/simsree-mumbai.png",
    "welingkar-mumbai": "/logos/welingkar-mumbai.jpg",
    "spjimr-mumbai": "/logos/spjimr-mumbai.png",
    "aiims-new-delhi": "/logos/aiims-new-delhi.png",
    "nid-ahmedabad": "/logos/nid-ahmedabad.png",
    "bjmc-pune": "/logos/bjmc-pune.png",
    "ggmc-jj-mumbai": "/logos/ggmc-jj-mumbai.png",
    "tnmc-nair-mumbai": "/logos/tnmc-nair-mumbai.png",
    "mimer-talegaon": "/logos/mimer-talegaon.png",
    "kjsim-mumbai": "/logos/kjsim-mumbai.png",
}


async def apply_college_logos() -> None:
    try:
        if await db.settings.find_one({"key": FLAG}):
            return
        n = 0
        for slug, logo in LOGOS.items():
            match = {"slug": slug} if slug in REPLACE else {"slug": slug, "$or": [{"logo": ""}, {"logo": None}, {"logo": {"$exists": False}}]}
            r = await db.colleges.update_one(match, {"$set": {"logo": logo}})
            n += r.modified_count
        await db.settings.update_one({"key": FLAG}, {"$set": {"key": FLAG, "done": True, "updated": n}}, upsert=True)
    except Exception as exc:  # noqa: BLE001
        logger.error("College logos failed: %s", exc)
