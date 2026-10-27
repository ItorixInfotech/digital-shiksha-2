"""One-time enrichment of the top 15 new Maharashtra + top 15 new Karnataka B.Tech colleges (Collegedunia order):
average / highest package + placement rate, and B.Tech cut-offs.

- Cut-offs: Maharashtra colleges in the CAP use the official MHT CET 2026 CAP Round I closing percentile (Open, state /
  home-university seat); Karnataka colleges in KCET use the official KEA UGCET 2025 Round I General Merit closing rank.
  IIT / NIT / IIIT seats (JoSAA) are approximate previous-year closing ranks.
- Packages: approximate recent placement-report figures (LPA), editable in Admin → Colleges.
Only empty fields are filled, and only once per database (settings flag), so admin edits are never overwritten.
"""
import logging

from lib.db import db

logger = logging.getLogger(__name__)
FLAG = "colleges_placements_v1"

# slug: (avg LPA, highest LPA, placement rate %)
PLACEMENTS = {
    # Maharashtra
    "vnit-nagpur": (11.5, 52, 88), "sit-nagpur": (5.5, 14, 78), "iiit-pune": (15.0, 49, 90), "i2it-pune": (6.5, 22, 85),
    "wce-sangli": (7.5, 33, 86), "pvgcoet-pune": (5.5, 21, 80), "bharati-vidyapeeth-college-of-engineering-for-women-pune": (5.0, 12, 75),
    "mcoe-pune": (5.5, 22, 80), "sies-gst-navi-mumbai": (5.5, 20, 82), "geca-aurangabad": (6.0, 20, 72), "ghrce-nagpur": (5.5, 30, 82),
    "pccoer-pune": (5.0, 12, 76), "xie-mumbai": (5.0, 15, 75), "sfit-mumbai": (5.5, 18, 80), "vit-mumbai": (5.5, 20, 80),
    # Karnataka
    "nit-surathkal": (16.0, 54, 90), "iisc-bangalore": (25.0, 60, 95), "iiit-bangalore": (30.0, 64, 98), "rvce-bangalore": (11.5, 62, 92),
    "bmsce-bangalore": (9.0, 50, 90), "iit-dharwad": (17.0, 50, 85), "rit-bangalore": (9.0, 50, 90), "pesu-bangalore": (10.0, 65, 90),
    "mahe-manipal": (13.0, 54, 90), "cmrit-bangalore": (6.0, 40, 85), "sit-tumkur": (6.0, 30, 85), "dsce-bangalore": (6.5, 40, 85),
    "iiit-dharwad": (11.0, 40, 85), "nmit-bangalore": (6.5, 40, 85), "nhce-bangalore": (6.0, 40, 85),
}

# MHT CET CAP institute code for the Maharashtra colleges above (official 2026 CAP cut-offs).
CAP_CODE = {
    "i2it-pune": "06754", "wce-sangli": "06007", "pvgcoet-pune": "06274", "bharati-vidyapeeth-college-of-engineering-for-women-pune": "06285",
    "mcoe-pune": "06139", "sies-gst-navi-mumbai": "03211", "geca-aurangabad": "02008", "ghrce-nagpur": "04116", "pccoer-pune": "06822",
    "xie-mumbai": "03214", "sfit-mumbai": "03204", "vit-mumbai": "03139",
}


def _josaa(branch: str, rank: int, exam: str = "JEE Main (JoSAA)", usable: bool = False) -> dict:
    return {"exam": exam, "branch": branch, "category": "General", "value": float(rank) if usable else None,
            "cutoff": f"≈ Closing rank {rank:,} (OPEN, previous year)"}


# Institutes outside the state CAP / KCET (JoSAA or own admissions) — approximate previous-year OPEN closing ranks.
JOSAA = {
    "vnit-nagpur": [_josaa("Computer Science & Engineering", 5000), _josaa("Electronics & Communication Engineering", 9500), _josaa("Mechanical Engineering", 20000)],
    "iiit-pune": [_josaa("Computer Science & Engineering", 21000), _josaa("Electronics & Communication Engineering", 32000)],
    "nit-surathkal": [_josaa("Computer Science & Engineering", 3500), _josaa("Electronics & Communication Engineering", 6500), _josaa("Mechanical Engineering", 15000)],
    "iit-dharwad": [_josaa("Computer Science & Engineering", 5500, "JEE Advanced", True), _josaa("Electrical Engineering", 9800, "JEE Advanced", True),
                    _josaa("Mechanical Engineering", 14000, "JEE Advanced", True)],
    "iiit-dharwad": [_josaa("Computer Science & Engineering", 23000), _josaa("Electronics & Communication Engineering", 33000)],
    "iiit-bangalore": [_josaa("Integrated M.Tech CSE", 6000, "JEE Main")],
}
SEATS = ("GOPENS", "GOPENH", "GOPENO")


async def _cap_rows(code: str) -> list[dict]:
    best: dict[str, float] = {}
    async for r in db.cap_cutoffs.find({"college_code": code, "program": {"$in": ["engineering", None]}}, {"_id": 0, "branch": 1, "rounds": 1}):
        r1 = r.get("rounds", {}).get("1", {})
        seat = next((s for s in SEATS if s in r1), None)
        if seat:
            best[r["branch"]] = max(best.get(r["branch"], 0), r1[seat][1])
    top = sorted(best.items(), key=lambda x: -x[1])[:6]
    return [{"exam": "MHT CET", "branch": b, "category": "General", "value": round(p, 2), "cutoff": f"{p:.2f} percentile (CAP 2026 Round I, Open)"} for b, p in top]


async def _kcet_rows(slug: str) -> list[dict]:
    best: dict[str, int] = {}
    async for r in db.kcet_cutoffs.find({"college_slug": slug, "ranks.GM": {"$exists": True}}, {"_id": 0, "branch": 1, "ranks.GM": 1}):
        best[r["branch"]] = min(best.get(r["branch"], 10 ** 9), r["ranks"]["GM"])
    top = sorted(best.items(), key=lambda x: x[1])[:6]
    return [{"exam": "KCET", "branch": b, "category": "General", "value": float(k), "cutoff": f"Closing rank {k:,} (KCET 2025 Round I, GM)"} for b, k in top]


async def run_college_enrich() -> None:
    try:
        if await db.settings.find_one({"key": FLAG}):
            return
        if not await db.kcet_cutoffs.count_documents({}, limit=1) or not await db.cap_cutoffs.count_documents({}, limit=1):
            logger.warning("College enrich postponed: cut-off data not loaded yet")
            return
        done = 0
        for slug, (avg, high, rate) in PLACEMENTS.items():
            c = await db.colleges.find_one({"slug": slug}, {"_id": 0, "avg_package": 1, "cutoffs": 1, "state": 1})
            if not c:
                continue
            upd: dict = {}
            if not c.get("avg_package"):
                upd |= {"avg_package": avg, "highest_package": high, "placement_rate": rate}
            if not c.get("cutoffs"):
                rows = (await _cap_rows(CAP_CODE[slug]) if slug in CAP_CODE else []) + (await _kcet_rows(slug) if c.get("state") == "Karnataka" else []) + JOSAA.get(slug, [])
                if rows:
                    upd["cutoffs"] = rows
            if upd:
                await db.colleges.update_one({"slug": slug}, {"$set": upd})
                done += 1
        await db.settings.update_one({"key": FLAG}, {"$set": {"key": FLAG, "done": True, "updated": done}}, upsert=True)
        logger.info("College placements/cut-offs enriched: %d", done)
    except Exception as exc:  # noqa: BLE001
        logger.error("College enrich failed: %s", exc)
