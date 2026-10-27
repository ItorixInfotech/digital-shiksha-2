"""KCET (KEA UGCET) engineering closing ranks for the KCET college predictor.

Bundled file data/kcet_cutoffs_2025.json.gz (built by scripts/build_kcet_data.py) is loaded into the `kcet_cutoffs`
collection at startup whenever its version changes, so production (Atlas) needs no manual import.
"""
import asyncio
import gzip
import json
import logging
import re
from pathlib import Path

from lib.db import db

logger = logging.getLogger(__name__)


def _read_gz(path: Path) -> dict:
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "kcet_cutoffs_2025.json.gz"
VERSION_KEY = "kcet_cutoffs_version"
LOADER_REV = "3"  # bump when the stored fields change, to force a reload
YEAR = 2025
SOURCE_URL = "https://cetonline.karnataka.gov.in/kea/ugcet2025"
SOURCE = f"KEA UGCET {YEAR} First Round allotment closing ranks (official KEA cut-off list) — {SOURCE_URL}"

# Predictor category -> KEA category prefix (GM = General Merit; seat codes add G / K (Kannada) / R (Rural)).
CATEGORIES = ["General", "1", "2A", "2B", "3A", "3B", "SC", "ST"]
PREFIX = {"General": "GM", "1": "1", "2A": "2A", "2B": "2B", "3A": "3A", "3B": "3B", "SC": "SC", "ST": "ST"}
SEAT_LABEL = {"GM": "General Merit", "GMK": "General Merit · Kannada", "GMR": "General Merit · Rural"}
CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Dharwad", "Belagavi", "Davanagere", "Tumakuru", "Shivamogga", "Kalaburagi", "Hassan", "Mandya"]

# KEA college code -> college page on this site (city + type come from the site page when mapped).
SLUG_BY_CODE = {
    "E002": "government-sri-krishnarajendra-silver-jubilee-technological-institute-bangalore", "E003": "bmsce-bangalore", "E048": "bmsce-bangalore",
    "E005": "rvce-bangalore", "E006": "rit-bangalore", "E007": "dsce-bangalore", "E008": "bit-bangalore", "E009": "pesu-bangalore", "E141": "pesu-bangalore",
    "E011": "mvjce-bangalore", "E014": "sjcit-chikkaballapur", "E016": "sit-tumkur", "E017": "ssit-tumkur", "E021": "sjce-mysore", "E284": "sjce-mysore",
    "E057": "jssstu-mysore", "E022": "nie-mysore", "E056": "nie-mysore", "E178": "nie-mysore", "E023": "pesce-mandya", "E058": "pesce-mandya",
    "E024": "mce-hassan", "E047": "mce-hassan", "E031": "bec-bagalkot", "E049": "bec-bagalkot",
    "E036": "kle-dr-m-s-sheshgiri-college-of-engineering-technology-belgaum", "E038": "bldea-s-v-p-dr-p-g-halakatti-college-of-engineering-technology-bijapur",
    "E041": "pda-college-of-engineering-gulbarga", "E059": "pda-college-of-engineering-gulbarga", "E061": "ubdt-college-of-engineering-davanagere",
    "E066": "ubdt-college-of-engineering-davanagere", "E062": "biet-davanagere", "E065": "jnnce-shimoga", "E071": "vvce-mysore", "E075": "bitm-bellary",
    "E077": "vviet-mysore", "E078": "the-oxford-college-of-engineering-bangalore", "E079": "ait-bangalore", "E082": "jssate-bangalore", "E091": "ksit-bangalore",
    "E092": "vemana-institute-of-technology-bangalore", "E095": "amc-bangalore", "E096": "epgi-bangalore", "E097": "cmrit-bangalore",
    "E098": "atria-institute-of-technology-bangalore", "E099": "nhce-bangalore", "E102": "dbit-bangalore", "E103": "gat-bangalore", "E104": "ncet-bangalore",
    "E106": "ewit-bangalore", "E108": "sapthagiri-nps-university-bangalore", "E111": "svce-bangalore", "E115": "bgs-sjb-group-of-institutions-bangalore",
    "E123": "cec-mangalore", "E128": "sharnbasva-university-gulbarga", "E129": "sjec-mangalore", "E133": "gsssietw-mysore", "E135": "vdit-haliyal",
    "E145": "rrce-bangalore", "E149": "citech-bangalore", "E150": "pesitm-shimoga", "E151": "mite-mangalore", "E155": "gech-hassan", "E158": "mit-mysore",
    "E160": "sahyadri-college-of-engineering-management-scem-mangalore", "E169": "alva-s-institute-of-engineering-and-technology-mangalore",
    "E172": "rr-group-of-institutions-bangalore", "E173": "svit-bangalore", "E186": "acsce-bangalore", "E196": "jce-belgaum", "E201": "gcem-bangalore",
    "E203": "kssem-bangalore", "E205": "atme-mysore", "E212": "dsatm-bangalore", "E220": "alliance-university-bangalore",
    "E222": "cambridge-institute-of-technology-north-campus-bangalore", "E237": "presidency-university-bangalore", "E240": "dsu-bangalore",
    "E241": "kletu-hubli", "E255": "gitam-bengaluru-bangalore", "E257": "cmr-university-lakeside-campus-bangalore", "E258": "mitt-mysore",
    "E269": "jcer-belagavi", "E275": "rvitm-bangalore", "E283": "uom-mysore", "E285": "rvu-bangalore", "E286": "bgscet-bangalore",
    "E302": "amity-university-bangalore", "E303": "gm-university-davanagere", "E306": "chanakya-university-bangalore",
}

# Earliest keyword in the KEA college name/address decides the city of unmapped colleges.
CITY_WORDS = [
    (r"bangalore|bengaluru|banglaore|bangaluru|yelahanka|devanahalli|doddaballapur|anekal|kengeri|hebbal", "Bengaluru"),
    (r"mysore|mysuru", "Mysuru"), (r"mangalore|mangaluru|moodabid|moodbid|mukka|bantwal|kairangal", "Mangaluru"),
    (r"ujire|sullia|puttur|dakshina kannada", "Dakshina Kannada"),
    (r"tumkur|tiptur|gubbi", "Tumakuru"), (r"belgaum|belagavi|nidasoshi|chikkodi|nippani", "Belagavi"), (r"hubli|hubballi", "Hubballi"),
    (r"dharwad", "Dharwad"), (r"davangere|davanagere|davengere", "Davanagere"), (r"shimoga|shivamogga", "Shivamogga"), (r"hassan|shravanabelagola|arasikere", "Hassan"),
    (r"mandya|maddur|k r pet", "Mandya"), (r"gulbarga|kalaburagi|kalburgi", "Kalaburagi"), (r"bidar|bhalki|basavakalyan", "Bidar"),
    (r"bijapur|vijayapura", "Vijayapura"), (r"bellary|ballari|hospet", "Ballari"), (r"raichur", "Raichur"), (r"bagalkot|mudhol", "Bagalkot"),
    (r"udupi|kundapura", "Udupi"), (r"chitradurga|challakere", "Chitradurga"), (r"chickamagalur|chikmagalur", "Chikkamagaluru"),
    (r"chik+a?bal+apur|chickbal+apur|chintamani", "Chikkaballapur"), (r"kolar|\bkgf\b", "Kolar"), (r"ramanagar|bidadi|channapat", "Ramanagara"),
    (r"gadag|hulkoti|naragund", "Gadag"), (r"karwar|bhatkal|haliyal", "Uttara Kannada"), (r"koppal|gangavathi", "Koppal"), (r"haveri|ranebennur", "Haveri"),
    (r"coorg|kushalanagar|ponnampet", "Kodagu"), (r"chamarajanagar", "Chamarajanagar"), (r"yadgir|yadigir|shorapur", "Yadgir"),
]
GOVT = re.compile(r"government|govt|univesity of visvesvaraya|u\.?b\.?d\.?t|visvesvaraya technological|constituent college of vtu|university of mysuru", re.I)


_TAIL = re.compile(r"(?:[\s,]+(?:P\.?\s?B\.?|NO\.?|SY\.?|RS\.?|NH|KM|R\.V|K R|T\.S|P J|\(BH|\(K M|\(U K|BEHIND|\d\S*))+$")


NAME_FIX = {"E001": "University of Visvesvaraya College of Engineering (UVCE), Bengaluru"}


def display_name(raw: str) -> str:
    """KEA names carry the postal address in CAPS after the name — keep only the name part."""
    s = re.sub(r"\s*\((AUTONOMOUS|[^)]{25,})\)\s*", " ", raw).strip()
    if not any(ch.islower() for ch in s):  # all-caps entry: name, first place
        return ", ".join(p.strip() for p in re.split(r"\s[#0-9]", s)[0].split(",")[:2]).title()
    words, out = s.split(), []
    for i, w in enumerate(words):
        letters = re.sub(r"[^A-Za-z]", "", w)
        nxt = re.sub(r"[^A-Za-z]", "", words[i + 1]) if i + 1 < len(words) else ""
        if w.startswith("#") or (out and len(letters) >= 3 and letters.isupper() and (not nxt or (len(nxt) >= 2 and nxt.isupper()))):
            break
        out.append(w)
    return _TAIL.sub("", " ".join(out)).rstrip(" ,.-")


def city_of(name: str) -> str:
    low = name.lower()
    hits = [(m.start(), city) for pat, city in CITY_WORDS for m in [re.search(pat, low)] if m]
    return min(hits)[1] if hits else "Karnataka"


def seat_codes(category: str, kannada: bool, rural: bool) -> list[str]:
    """Every KEA seat type this student may be allotted: General Merit + own category, General / Kannada / Rural."""
    suffixes = ["G"] + (["K"] if kannada else []) + (["R"] if rural else [])
    codes = ["GM"] + [f"GM{s}" for s in suffixes[1:]]
    if category != "General":
        codes += [PREFIX[category] + s for s in suffixes]
    return codes


async def load_kcet_data() -> None:
    """Startup task: (re)load the bundled KCET file when its version changes. Never raises."""
    try:
        if not DATA_FILE.exists():
            return
        payload = await asyncio.to_thread(_read_gz, DATA_FILE)  # off the event loop: requests keep flowing during boot
        version = f"{payload['version']}:{LOADER_REV}"
        cur = await db.settings.find_one({"key": VERSION_KEY})
        if cur and cur.get("version") == version and await db.kcet_cutoffs.count_documents({}, limit=1):
            return
        site = {c["slug"]: c async for c in db.colleges.find({"slug": {"$in": list(set(SLUG_BY_CODE.values()))}}, {"_id": 0, "slug": 1, "name": 1, "city": 1, "type": 1})}
        docs = []
        for c in payload["courses"]:
            slug = SLUG_BY_CODE.get(c["college_code"], "")
            page = site.get(slug, {})
            docs.append({**c, "college_slug": slug if page else "", "display_name": page.get("name") or NAME_FIX.get(c["college_code"]) or display_name(c["college_name"]), "city": page.get("city") or city_of(c["college_name"]),
                         "type": page.get("type") or ("Government" if GOVT.search(c["college_name"]) else "Private"),
                         "branch_lc": c["branch"].lower(), "course_code": f"{c['college_code']}-{c['branch_code']}"})
        await db.kcet_cutoffs.delete_many({})
        for i in range(0, len(docs), 500):
            await db.kcet_cutoffs.insert_many(docs[i:i + 500])
        await db.settings.update_one({"key": VERSION_KEY}, {"$set": {"key": VERSION_KEY, "version": version, "count": len(docs)}}, upsert=True)
        logger.info("Loaded %d KCET cut-off rows (%s)", len(docs), version)
    except Exception as exc:  # noqa: BLE001
        logger.error("KCET cut-off load failed: %s", exc)
