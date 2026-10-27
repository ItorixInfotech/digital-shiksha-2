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
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
# program → bundled data file (official CET Cell CAP cut-offs, Maharashtra & minority seats, Rounds I–IV)
DATA_FILES = {"engineering": _DATA_DIR / "cap_cutoffs_2026.json.gz", "pharmacy": _DATA_DIR / "cap_pharmacy_2026.json.gz"}
VERSION_KEY = "cap_cutoffs_version"
SOURCE_URL = "https://cetcell.mahacet.org/"
# predictor exam name → CAP program
EXAM_PROGRAM = {"MHT CET": "engineering", "MHT CET Pharmacy": "pharmacy"}
PROGRAM_LABEL = {"engineering": "Engineering (B.E./B.Tech)", "pharmacy": "B.Pharmacy & Pharm.D"}

# CAP institute code → existing college page on this site.
SLUG_BY_CODE = {
    "16006": "coep-pune", "06271": "pict-pune", "06273": "vit-pune", "06175": "pccoe-pune", "06276": "cummins-pune",
    "06278": "aissms-coe-pune", "06272": "dypcoe-akurdi", "06177": "scoe-pune", "06146": "mitaoe-pune",
    "03215": "spit-mumbai", "03199": "djsce-mumbai", "03182": "tsec-mumbai", "03184": "frcrce-mumbai",
    "03185": "vesit-mumbai", "03012": "vjti-mumbai", "03036": "ict-mumbai",
    # Collegedunia import (Nov 2026)
    "06754": "i2it-pune", "06007": "wce-sangli", "06274": "pvgcoet-pune", "06285": "bharati-vidyapeeth-college-of-engineering-for-women-pune",
    "06139": "mcoe-pune", "03211": "sies-gst-navi-mumbai", "02008": "geca-aurangabad", "04116": "ghrce-nagpur", "06822": "pccoer-pune",
    "03214": "xie-mumbai", "03204": "sfit-mumbai", "03139": "vit-mumbai",
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
PHARMA_GROUPS = {"B.Pharmacy": r"^pharmacy$", "Pharm.D (Doctor of Pharmacy)": r"pharm ?d"}
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


HOME_UNIVERSITIES = [
    "Dr. Babasaheb Ambedkar Marathwada University", "Dr. Babasaheb Ambedkar Technological University,Lonere", "Gondwana University",
    "Kavayitri Bahinabai Chaudhari North Maharashtra University, Jalgaon", "Mumbai University", "Punyashlok Ahilyadevi Holkar Solapur University",
    "Rashtrasant Tukadoji Maharaj Nagpur University", "SNDT Women's University", "Sant Gadge Baba Amravati University",
    "Savitribai Phule Pune University", "Shivaji University", "Swami Ramanand Teerth Marathwada University, Nanded",
]


def canonical_hu(hu: str) -> str:
    """Some PDFs wrap long university names; map a truncated name back to the full one."""
    hu = (hu or "").strip()
    if len(hu) >= 12:
        for full in HOME_UNIVERSITIES:
            if full.startswith(hu):
                return full
    return hu


def groups_for(program: str) -> dict:
    return PHARMA_GROUPS if program == "pharmacy" else BRANCH_GROUPS


async def load_cap_data() -> None:
    """Startup task: (re)load each bundled cut-off file when its version changes. Never raises."""
    for program, path in DATA_FILES.items():
        await _load_program(program, path)
    try:  # college-page links for newly mapped CAP codes (cheap; the data reload only runs on a version change)
        for code, slug in SLUG_BY_CODE.items():
            await db.cap_cutoffs.update_many({"college_code": code, "program": {"$in": ["engineering", None]}, "college_slug": {"$ne": slug}}, {"$set": {"college_slug": slug}})
    except Exception as exc:  # noqa: BLE001
        logger.error("CAP slug sync failed: %s", exc)


async def _load_program(program: str, path: Path) -> None:
    try:
        if not path.exists():
            return
        with gzip.open(path, "rt", encoding="utf-8") as fh:
            payload = json.load(fh)
        key = f"{VERSION_KEY}:{program}"
        match = {"program": {"$in": [program, None]}} if program == "engineering" else {"program": program}
        cur = await db.settings.find_one({"key": key})
        if cur and cur.get("version") == payload["version"] and await db.cap_cutoffs.count_documents(match, limit=1):
            return
        docs = []
        for c in payload["courses"]:
            city, region = place_of(c["college_code"], c["college_name"])
            docs.append({**c, "status": re.sub(r"^Status:\s*", "", c.get("status", "")).strip(),
                         "home_university": canonical_hu(c.get("home_university", "")), "program": program, "city": city, "region": region, "college_slug": SLUG_BY_CODE.get(c["college_code"], ""),
                         "branch_lc": c["branch"].lower()})
        await db.cap_cutoffs.delete_many(match)
        for i in range(0, len(docs), 500):
            await db.cap_cutoffs.insert_many(docs[i:i + 500])
        await db.settings.update_one({"key": key}, {"$set": {"key": key, "version": payload["version"], "count": len(docs)}}, upsert=True)
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
