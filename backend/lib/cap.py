"""Official MHT CET 2026 CAP cut-offs (CET Cell, Engineering, Maharashtra seats, Rounds I–IV).

Data file: backend/data/cap_cutoffs_2026.json.gz (built by scripts/parse_cap_pdfs.py from fe2026.mahacet.org PDFs).
Loaded into the `cap_cutoffs` collection at startup whenever the file version changes — so preview and production
(Atlas) both get the same data without a manual import. One document per college × branch (CAP course code).
Seat codes: G/L (general/ladies) + OPEN/OBC/SC/ST/VJ/NT1/NT2/NT3/SEBC + H/O/S (home univ / other / state level),
plus EWS and TFWS. Each round stores {code: [merit_no, percentile]} with the closing (most lenient) stage.
"""
import gzip
import json
import logging
import re
from pathlib import Path

from lib.db import db

logger = logging.getLogger(__name__)
DATA = Path(__file__).resolve().parent.parent / "data" / "cap_cutoffs_2026.json.gz"
VERSION_KEY = "cap_cutoffs_version"
SOURCE_URL = "https://fe2026.mahacet.org/"

# CAP institute code → existing college page on this site.
SLUG_BY_CODE = {
    "16006": "coep-pune", "06271": "pict-pune", "06273": "vit-pune", "06175": "pccoe-pune", "06276": "cummins-pune",
    "06278": "aissms-coe-pune", "06272": "dypcoe-akurdi", "06177": "scoe-pune", "06146": "mitaoe-pune",
    "03215": "spit-mumbai", "03199": "djsce-mumbai", "03182": "tsec-mumbai", "03184": "frcrce-mumbai",
    "03185": "vesit-mumbai", "03012": "vjti-mumbai", "03036": "ict-mumbai",
}

# Rightmost match wins. Locality aliases fold into their city.
CITIES = ["Pune", "Mumbai", "Navi Mumbai", "Thane", "Nagpur", "Nashik", "Aurangabad", "Chhatrapati Sambhajinagar", "Solapur",
          "Kolhapur", "Sangli", "Satara", "Amravati", "Akola", "Jalgaon", "Dhule", "Nanded", "Latur", "Ahmednagar", "Ahilyanagar",
          "Chandrapur", "Yavatmal", "Wardha", "Ratnagiri", "Raigad", "Palghar", "Beed", "Osmanabad", "Dharashiv", "Parbhani",
          "Jalna", "Buldhana", "Washim", "Hingoli", "Gondia", "Bhandara", "Gadchiroli", "Sindhudurg", "Nandurbar", "Lonere",
          "Karad", "Baramati", "Pandharpur", "Shegaon", "Sangamner", "Kopargaon", "Ichalkaranji", "Panvel", "Kalyan", "Bhiwandi",
          "Vasai", "Virar", "Karjat", "Lonavala", "Miraj", "Malegaon", "Shirpur", "Barshi", "Khamgaon", "Bhusawal", "Ambernath",
          "Badlapur", "Dombivli", "Ulhasnagar"]
ALIASES = {"Andheri": "Mumbai", "Bandra": "Mumbai", "Matunga": "Mumbai", "Chembur": "Mumbai", "Vile Parle": "Mumbai", "Kurla": "Mumbai",
           "Borivali": "Mumbai", "Ghatkopar": "Mumbai", "Powai": "Mumbai", "Sion": "Mumbai", "Wadala": "Mumbai", "Goregaon": "Mumbai",
           "Malad": "Mumbai", "Kandivali": "Mumbai", "Mira Road": "Mumbai", "Nerul": "Navi Mumbai", "Vashi": "Navi Mumbai",
           "Kharghar": "Navi Mumbai", "Airoli": "Navi Mumbai", "Belapur": "Navi Mumbai", "Sanpada": "Navi Mumbai",
           "Kopar Khairane": "Navi Mumbai", "Pimpri": "Pune", "Chinchwad": "Pune", "Akurdi": "Pune", "Hadapsar": "Pune", "COEP": "Pune",
           "Sambhajinagar": "Aurangabad", "Chhatrapati Sambhajinagar": "Aurangabad", "Ahilyanagar": "Ahmednagar", "Dharashiv": "Osmanabad"}
# CAP institute code prefix → CET Cell region (used for "nearby" city filtering and as a city fallback).
REGION = {"01": "Amravati", "02": "Aurangabad", "03": "Mumbai", "04": "Nagpur", "05": "Nashik", "06": "Pune", "14": "Nagpur", "16": "Pune"}
CATEGORIES = ["General", "OBC", "EWS", "SC", "ST", "VJ", "NT1", "NT2", "NT3", "SEBC", "TFWS"]
CAT_PART = {"General": "OPEN", "OBC": "OBC", "SC": "SC", "ST": "ST", "VJ": "VJ", "NT1": "NT1", "NT2": "NT2", "NT3": "NT3", "SEBC": "SEBC"}
BRANCH_GROUPS = {
    "Computer / IT / AI": r"comput|information tech|artificial|data sci|cyber|machine learn|software|internet of things|\biot\b|block ?chain",
    "Electronics & Telecom": r"electronics|telecom|vlsi|communication",
    "Electrical": r"electrical",
    "Mechanical / Automobile": r"mechanic|automobile|automation|robotic|mechatronic|production|manufactur|industrial",
    "Civil": r"civil|construction|structural",
    "Chemical / Biotech / Food": r"chemical|biotech|food|pharma|petro|polymer|textile|dyestuff|oil|paint|plastic",
    "Instrumentation": r"instrument",
}


def place_of(code: str, name: str) -> tuple[str, str]:
    """(city, region) for a CAP institute."""
    region = REGION.get(code[:2], "")
    city = city_of(name)
    if city == "Maharashtra":
        tail = re.sub(r"[\d\-.()]+", " ", name.split(",")[-1]).strip().title() if "," in name else ""
        city = tail if tail and len(tail) <= 24 else (region or "Maharashtra")
    return city, region or city


def city_of(name: str) -> str:
    best, end, klen = "", -1, 0
    for key, city in [(c, c) for c in CITIES] + list(ALIASES.items()):
        for m in re.finditer(rf"\b{re.escape(key)}\b", name, flags=re.I):
            # rightmost match wins; on the same end, the longer key ("Navi Mumbai" beats "Mumbai")
            if m.end() > end or (m.end() == end and len(key) > klen):
                best, end, klen = city, m.end(), len(key)
    return ALIASES.get(best, best) or "Maharashtra"


async def load_cap_data() -> None:
    """Startup task: (re)load the bundled cut-off file when its version changes. Never raises."""
    try:
        if not DATA.exists():
            return
        with gzip.open(DATA, "rt", encoding="utf-8") as fh:
            payload = json.load(fh)
        cur = await db.settings.find_one({"key": VERSION_KEY})
        if cur and cur.get("version") == payload["version"] and await db.cap_cutoffs.estimated_document_count():
            return
        docs = []
        for c in payload["courses"]:
            city, region = place_of(c["college_code"], c["college_name"])
            docs.append({**c, "city": city, "region": region, "college_slug": SLUG_BY_CODE.get(c["college_code"], ""),
                         "branch_lc": c["branch"].lower()})
        await db.cap_cutoffs.delete_many({})
        for i in range(0, len(docs), 500):
            await db.cap_cutoffs.insert_many(docs[i:i + 500])
        await db.settings.update_one({"key": VERSION_KEY}, {"$set": {"key": VERSION_KEY, "version": payload["version"], "count": len(docs)}}, upsert=True)
        logger.info("Loaded %d CAP cut-off rows (%s)", len(docs), payload["version"])
    except Exception as exc:  # noqa: BLE001
        logger.error("CAP cut-off load failed: %s", exc)


def seat_codes(category: str, ladies: bool, own_hu: bool | None) -> list[str]:
    """Every seat type this student may be allotted. own_hu None = home university not chosen → Other-than-HU seats."""
    genders = ["G", "L"] if ladies else ["G"]
    cats = ["OPEN"] + ([CAT_PART[category]] if CAT_PART.get(category, "OPEN") != "OPEN" else [])
    suffixes = ["S", "H" if own_hu else "O"]
    codes = [g + c + s for g in genders for c in cats for s in suffixes]
    if category == "EWS":
        codes.append("EWS")
    if category == "TFWS":
        codes.append("TFWS")
    return codes
