"""Auto-generated Stream × City landing pages (e.g. /engineering-colleges-in-pune) with admin overrides."""
import re
from collections import Counter
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.dates import today_iso
from lib.db import db
from models.content import FaqItem, SeoMeta
from models.landing import LandingLink, LandingOverrideIn, LandingPage, LandingStats, LandingSummary
from routers.admin import require_admin

router = APIRouter()
LABEL = {"Management": "MBA", "Computer Applications": "BCA / MCA"}
SLUG = {"Management": "mba", "Computer Applications": "bca-mca"}
PHONE = "+91 8149 68 9468"


def _slugify(s: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


def _slug(stream: str, city: str) -> str:
    return f"{SLUG.get(stream, _slugify(stream))}-colleges-in-{_slugify(city)}"


def _inr(n: float) -> str:
    if not n:
        return "-"
    return f"₹{n / 100000:.1f} L".replace(".0 L", " L") if n >= 100000 else f"₹{int(n):,}"


def _year() -> int:
    return int(today_iso("Asia/Kolkata")[:4])


def _defaults(stream: str, city: str, count: int, year: int) -> tuple[str, str]:
    lab = LABEL.get(stream, stream)
    return (f"Top {lab} Colleges in {city} {year}: Fees, Ranking | Digital Shiksha",
            f"List of {count} best {lab} colleges in {city} {year} with fees, NIRF ranking, cutoffs & placements. Free admission counselling: {PHONE}.")


async def _overrides() -> dict:
    return {d["slug"]: d async for d in db.landing_pages.find({}, {"_id": 0})}


async def _combos() -> list[tuple[str, str, int]]:
    rows = await db.colleges.aggregate([
        {"$unwind": "$streams"}, {"$group": {"_id": {"s": "$streams", "c": "$city"}, "n": {"$sum": 1}}},
    ]).to_list(2000)
    return sorted(((r["_id"]["s"], r["_id"]["c"], r["n"]) for r in rows if r["_id"]["s"] and r["_id"]["c"]), key=lambda x: (-x[2], x[0], x[1]))


async def list_landing() -> List[LandingSummary]:
    year, ov = _year(), await _overrides()
    out = []
    for stream, city, n in await _combos():
        slug = _slug(stream, city)
        t, d = _defaults(stream, city, n, year)
        o = ov.get(slug)
        out.append(LandingSummary(slug=slug, stream=stream, city=city, label=f"{LABEL.get(stream, stream)} Colleges in {city}", count=n,
                                  customised=bool(o), default_title=t, default_description=d,
                                  override=LandingOverrideIn(**{k: o.get(k) for k in ("intro", "faqs", "seo") if o.get(k) is not None}) if o else None))
    return out


def _auto_faqs(lab: str, city: str, cols: list[dict], st: LandingStats, year: int) -> list[FaqItem]:
    top = cols[:3]
    names = ", ".join(c.get("short_name") or c["name"] for c in top)
    best = cols[0]
    faqs = [
        FaqItem(question=f"How many {lab} colleges are there in {city}?",
                answer=f"Digital Shiksha lists {st.count} {lab} colleges in {city} for {year} admissions, including {names}."),
        FaqItem(question=f"Which is the best {lab} college in {city}?",
                answer=f"{best['name']} is among the top {lab} colleges in {city}" + (f" with NIRF rank {best['nirf_rank']}" if best.get("nirf_rank") else "")
                + f". Other popular options are {', '.join(c.get('short_name') or c['name'] for c in cols[1:4]) or 'listed above'}."),
        FaqItem(question=f"What is the fee for {lab} colleges in {city}?",
                answer=f"Annual fees range from {_inr(st.fees_min)} to {_inr(st.fees_max)}, with an average of about {_inr(st.avg_fees)} per year. Government colleges are usually the most affordable."),
    ]
    if st.exams:
        faqs.append(FaqItem(question=f"Which entrance exams are accepted by {lab} colleges in {city}?",
                            answer=f"Most {lab} colleges in {city} admit students through {', '.join(st.exams)}. Check each college page for exam-wise cutoffs."))
    if st.top_package:
        faqs.append(FaqItem(question=f"What placements do {lab} colleges in {city} offer?",
                            answer=f"The average package is around ₹{st.avg_package:g} LPA and the highest package offered is ₹{st.top_package:g} LPA."))
    faqs.append(FaqItem(question=f"How can I get admission to {'an' if lab[0] in 'AEIOU' else 'a'} {lab} college in {city}?",
                        answer=f"Shortlist colleges by fees, cutoff and placements, apply through the relevant entrance exam / CAP round, and talk to a Digital Shiksha counsellor for free guidance on {PHONE}."))
    return faqs


@router.get("/landing", response_model=List[LandingSummary])
async def get_landing_list():
    return await list_landing()


@router.get("/landing/{slug}", response_model=LandingPage)
async def get_landing(slug: str):
    summary = next((s for s in await list_landing() if s.slug == slug), None)
    if not summary:
        raise HTTPException(status_code=404, detail="Page not found")
    year = _year()
    lab = LABEL.get(summary.stream, summary.stream)
    cols = await db.colleges.find({"streams": summary.stream, "city": summary.city}, {"_id": 0}).to_list(500)
    cols.sort(key=lambda c: (c.get("nirf_rank") or 9999, -(c.get("rating") or 0)))
    fees = [c["fees_min"] for c in cols if c.get("fees_min")]
    pk = [c["avg_package"] for c in cols if c.get("avg_package")]
    exams = [e for e, _ in Counter(e for c in cols for e in c.get("exams_accepted", [])).most_common(4)]
    st = LandingStats(count=len(cols), fees_min=min(fees, default=0), fees_max=max([c.get("fees_max") or c.get("fees_min") or 0 for c in cols], default=0),
                      avg_fees=int(sum(fees) / len(fees)) if fees else 0, avg_package=round(sum(pk) / len(pk), 1) if pk else 0,
                      top_package=max((c.get("highest_package") or 0 for c in cols), default=0), exams=exams)
    o = summary.override or LandingOverrideIn()
    default_intro = (f"Looking for the best {lab} colleges in {summary.city}? Here are {st.count} top {lab} colleges in {summary.city} for {year}, ranked by NIRF and rating. "
                     f"Fees range from {_inr(st.fees_min)} to {_inr(st.fees_max)} per year" + (f", average placements are around ₹{st.avg_package:g} LPA" if st.avg_package else "")
                     + (f" and admission is through {', '.join(exams)}" if exams else "")
                     + f". Compare fees, cutoffs and placements below, then book free admission counselling with Digital Shiksha.")
    others = await list_landing()
    link = lambda s: LandingLink(slug=s.slug, label=s.label, count=s.count)  # noqa: E731
    return LandingPage(**summary.model_dump(), year=year, h1=f"Top {lab} Colleges in {summary.city} {year}",
                       intro=o.intro or default_intro, faqs=o.faqs or _auto_faqs(lab, summary.city, cols, st, year), seo=o.seo, stats=st, colleges=cols,
                       same_city=[link(s) for s in others if s.city == summary.city and s.slug != slug][:8],
                       same_stream=[link(s) for s in others if s.stream == summary.stream and s.slug != slug][:8])


@router.put("/admin/landing/{slug}", response_model=LandingSummary)
async def save_landing(slug: str, body: LandingOverrideIn, _: str = Depends(require_admin)):
    if not any(s.slug == slug for s in await list_landing()):
        raise HTTPException(status_code=404, detail="Page not found")
    empty = not body.intro.strip() and not body.faqs and body.seo == SeoMeta()
    if empty:
        await db.landing_pages.delete_one({"slug": slug})
    else:
        await db.landing_pages.update_one({"slug": slug}, {"$set": {"slug": slug, **body.model_dump()}}, upsert=True)
    return next(s for s in await list_landing() if s.slug == slug)
