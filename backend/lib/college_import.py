"""One-time import of Maharashtra + Karnataka B.E/B.Tech colleges (Collegedunia listing, data/colleges_mh_ka.json).

New colleges are inserted; colleges already on the site only get their logo and fees updated. Runs once per
database (settings flag), so later admin edits are never overwritten. Logos are served from frontend/public/logos.
"""
import json
from pathlib import Path

from lib.db import db
from models.content import College

FLAG = "colleges_cd_import_v1"
FALLBACK_IMG = "https://images.unsplash.com/photo-1562774053-701939374585?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200"
DATA = Path(__file__).resolve().parents[1] / "data" / "colleges_mh_ka.json"


def _lakh(r: int) -> str:
    return f"₹{r / 100000:.2f} Lakh".replace(".00 ", " ")


def _new(c: dict) -> College:
    exams = c["exams"]
    total = c["fees_total"]
    fee_line = f" The total B.Tech fee is about {_lakh(total)} for 4 years (around {_lakh(c['fees_per_year'])} a year)." if total else ""
    return College(
        slug=c["slug"], name=c["name"], short_name=c["short_name"], city=c["city"], state=c["state"], type=c["type"],
        streams=["Engineering"], rating=c["rating"] or 4.0, fees_min=c["fees_per_year"], fees_max=c["fees_per_year"],
        approvals=["AICTE"], exams_accepted=exams, logo=c["logo"], image="" if c["logo"] else FALLBACK_IMG,
        overview=(f"{c['name']} is a {c['type'].lower()} engineering college in {c['city']}, {c['state']}, offering B.E/B.Tech programmes."
                  f"{fee_line} Digital Shiksha counsellors can help you check eligibility, cut-offs and the admission process for this college."),
        admission=(f"B.E/B.Tech admission is based on {', '.join(exams)} scores through the state counselling (CAP) rounds; "
                   "some colleges also fill management/institute-level seats directly. Call Digital Shiksha at +91 8149 68 9468 for guidance."),
        courses=[{"name": "B.E / B.Tech", "duration": "4 Years", "fees": f"{_lakh(total)} total" if total else "", "eligibility": "10+2 with Physics, Chemistry & Mathematics"}],
    )


async def run_college_import() -> None:
    if await db.settings.find_one({"key": FLAG}) or not DATA.exists():
        return
    rows = json.loads(DATA.read_text())
    added = updated = 0
    for c in rows:
        if await db.colleges.find_one({"slug": c["slug"]}, {"_id": 1}):
            upd = {"logo": c["logo"]} if c["logo"] else {}
            if c["fees_per_year"]:
                upd |= {"fees_min": c["fees_per_year"], "fees_max": c["fees_per_year"]}
            if upd:
                await db.colleges.update_one({"slug": c["slug"]}, {"$set": upd})
                updated += 1
        else:
            await db.colleges.insert_one(_new(c).model_dump())
            added += 1
    await db.settings.update_one({"key": FLAG}, {"$set": {"key": FLAG, "done": True, "added": added, "updated": updated}}, upsert=True)
