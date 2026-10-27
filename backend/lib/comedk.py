"""COMEDK UGET engineering closing ranks for the COMEDK college predictor (private / aided Karnataka colleges, all-India seats).

Bundled file data/comedk_cutoffs_2025.json.gz (built by scripts/build_comedk_data.py from the official COMEDK PDF) is loaded into the
`comedk_cutoffs` collection at startup whenever its version changes.
"""
import gzip
import json
import logging
import re
from pathlib import Path

from lib.db import db
from lib.kcet import CITY_WORDS

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "comedk_cutoffs_2025.json.gz"
VERSION_KEY = "comedk_cutoffs_version"
LOADER_REV = "1"  # bump when the stored fields change, to force a reload
YEAR = 2025
SOURCE_URL = "https://www.comedk.org/uploads/Engineering-Cut-Off-Ranks-after-Round-1-Allotment%5F-Notified-on-28%5F07%5F2025.pdf"
SOURCE = f"COMEDK UGET {YEAR} Engineering cut-off ranks after Round 1 allotment (official, notified 28.07.2025) — comedk.org"
CATEGORIES = ["General"]  # COMEDK has GM (all-India) + KKR (Kalyana-Karnataka) seats only
CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Dharwad", "Belagavi", "Davanagere", "Tumakuru", "Shivamogga", "Kalaburagi", "Hassan", "Mandya"]

# COMEDK college code -> college page on this site (matched against the KEA list, then reviewed by hand).
SLUG_BY_CODE = {
    "E001": "ait-bangalore", "E003": "acsce-bangalore", "E006": "alva-s-institute-of-engineering-and-technology-mangalore", "E007": "amc-bangalore",
    "E012": "atria-institute-of-technology-bangalore", "E016": "kletu-hubli", "E017": "bitm-bellary", "E019": "bit-bangalore", "E021": "biet-davanagere",
    "E024": "bec-bagalkot", "E026": "bldea-s-v-p-dr-p-g-halakatti-college-of-engineering-technology-bijapur", "E027": "bmsce-bangalore",
    "E032": "cmrit-bangalore", "E033": "citech-bangalore", "E036": "chanakya-university-bangalore", "E039": "dsatm-bangalore", "E040": "dsce-bangalore",
    "E041": "dbit-bangalore", "E046": "epgi-bangalore", "E048": "ewit-bangalore", "E050": "gat-bangalore", "E053": "gcem-bangalore",
    "E055": "gsssietw-mysore", "E056": "pda-college-of-engineering-gulbarga", "E058": "sjce-mysore", "E059": "jnnce-shimoga", "E060": "jssate-bangalore",
    "E061": "jssstu-mysore", "E062": "jce-belgaum", "E064": "jcer-belagavi", "E065": "kle-dr-m-s-sheshgiri-college-of-engineering-technology-belgaum",
    "E067": "kssem-bangalore", "E068": "ksit-bangalore", "E074": "vdit-haliyal", "E077": "rit-bangalore", "E078": "mit-mysore", "E079": "mce-hassan",
    "E080": "mite-mangalore", "E082": "mitt-mysore", "E084": "ncet-bangalore", "E085": "nie-mysore", "E089": "pesce-mandya", "E090": "pesitm-shimoga",
    "E095": "rvce-bangalore", "E097": "rr-group-of-institutions-bangalore", "E099": "rrce-bangalore", "E107": "bgs-sjb-group-of-institutions-bangalore",
    "E108": "sjcit-chikkaballapur", "E112": "sahyadri-college-of-engineering-management-scem-mangalore", "E113": "svit-bangalore",
    "E116": "sapthagiri-nps-university-bangalore", "E125": "sit-tumkur", "E137": "svce-bangalore", "E142": "nie-mysore",
    "E145": "vemana-institute-of-technology-bangalore", "E146": "vviet-mysore", "E147": "vvce-mysore", "E152": "atme-mysore",
    "E161": "cambridge-institute-of-technology-north-campus-bangalore", "E165": "alliance-university-bangalore", "E171": "gitam-bengaluru-bangalore",
    "E173": "presidency-university-bangalore", "E187": "cmr-university-lakeside-campus-bangalore", "E198": "rvitm-bangalore", "E207": "bgscet-bangalore",
}


def city_of(place: str) -> str:
    """COMEDK writes "Locality, City" — the LAST known city keyword wins (e.g. "Kambipura Mysore Road Bengaluru" -> Bengaluru)."""
    low = place.lower()
    hits = [(m.start(), city) for pat, city in CITY_WORDS for m in re.finditer(pat, low)]
    return max(hits)[1] if hits else "Karnataka"


def seat_codes(kkr: bool) -> list[str]:
    return ["GM", "KKR"] if kkr else ["GM"]


async def load_comedk_data() -> None:
    """Startup task: (re)load the bundled COMEDK file when its version changes. Never raises."""
    try:
        if not DATA_FILE.exists():
            return
        with gzip.open(DATA_FILE, "rt", encoding="utf-8") as fh:
            payload = json.load(fh)
        version = f"{payload['version']}:{LOADER_REV}"
        cur = await db.settings.find_one({"key": VERSION_KEY})
        if cur and cur.get("version") == version and await db.comedk_cutoffs.count_documents({}, limit=1):
            return
        site = {c["slug"]: c async for c in db.colleges.find({"slug": {"$in": list(set(SLUG_BY_CODE.values()))}}, {"_id": 0, "slug": 1, "name": 1, "city": 1, "type": 1})}
        docs = []
        for c in payload["courses"]:
            slug = SLUG_BY_CODE.get(c["college_code"], "")
            page = site.get(slug, {})
            name = re.sub(r"\s+\.", ".", re.sub(r"(?<=\b[A-Z]) \.", ".", c["college_name"])).replace("..", ".")
            docs.append({**c, "college_slug": slug if page else "", "display_name": page.get("name") or name,
                         "city": page.get("city") or city_of(c.get("place", "")), "type": page.get("type") or "Private",
                         "branch_lc": c["branch"].lower(), "course_code": f"{c['college_code']}-{c['branch_code']}"})
        await db.comedk_cutoffs.delete_many({})
        if docs:
            await db.comedk_cutoffs.insert_many(docs)
        await db.settings.update_one({"key": VERSION_KEY}, {"$set": {"key": VERSION_KEY, "version": version, "count": len(docs)}}, upsert=True)
        logger.info("Loaded %d COMEDK cut-off rows (%s)", len(docs), version)
    except Exception as exc:  # noqa: BLE001
        logger.error("COMEDK cut-off load failed: %s", exc)
