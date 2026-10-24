"""One-time content rollover to the 2027 admission season (idempotent, guarded by settings flags).

Exams are deliberately NOT rolled over: they keep their 2026 dates (EXAM_YEAR). An earlier version shifted exam
years +1; restore_exam_years() undoes that exactly once on databases where it ran.
Articles + college/course SEO text: "2026" -> "2027" (slugs too; old slugs still resolve). Publish dates untouched.
"""
import re

from lib.db import db

ADMISSION_YEAR = 2027  # admission season the site talks about (SEO keywords/scoring use this)
EXAM_YEAR = 2026  # exams keep their 2026 dates and titles
RESTORE_FLAG = "exam_years_2026_restored"
FLAG = "year_rollover_2027"
TEXT_FLAG = "year_rollover_2027_text"


def unshift_years(s: str) -> str:
    return re.sub(r"\b(2026|2027)\b", lambda m: str(int(m.group(1)) - 1), s)


def to_2027(s: str) -> str:
    return s.replace("2026", "2027")


def _seo(seo: dict | None) -> dict | None:
    if not isinstance(seo, dict):
        return seo
    return {k: to_2027(v) if isinstance(v, str) else [to_2027(x) if isinstance(x, str) else x for x in v] if isinstance(v, list) else v
            for k, v in seo.items()}


async def restore_exam_years() -> None:
    """Undo the old +1 exam shift once, only where it actually ran (old flag lacks exams_shifted=False)."""
    old = await db.settings.find_one({"key": FLAG})
    if not old or old.get("exams_shifted") is False or await db.settings.find_one({"key": RESTORE_FLAG}):
        return
    async for e in db.exams.find({}):
        upd = {f: unshift_years(e.get(f) or "") for f in ("exam_date", "application_deadline", "overview")}
        if isinstance(e.get("seo"), dict):
            upd["seo"] = {k: v.replace("2027", "2026") if isinstance(v, str) else [x.replace("2027", "2026") if isinstance(x, str) else x for x in v] if isinstance(v, list) else v
                          for k, v in e["seo"].items()}
        upd["faqs"] = [{**q, "question": q.get("question", "").replace("2027", "2026"), "answer": q.get("answer", "").replace("2027", "2026")} for q in e.get("faqs") or []]
        await db.exams.update_one({"_id": e["_id"]}, {"$set": upd})
    await db.settings.update_one({"key": RESTORE_FLAG}, {"$set": {"key": RESTORE_FLAG, "done": True}}, upsert=True)


async def run_year_rollover() -> None:
    await restore_exam_years()
    if not await db.settings.find_one({"key": FLAG}):
        await db.settings.update_one({"key": FLAG}, {"$set": {"key": FLAG, "done": True, "exams_shifted": False}}, upsert=True)
    if await db.settings.find_one({"key": TEXT_FLAG}):
        return
    for coll in ("colleges", "courses"):
        async for d in db[coll].find({"seo": {"$type": "object"}}, {"seo": 1}):
            await db[coll].update_one({"_id": d["_id"]}, {"$set": {"seo": _seo(d.get("seo"))}})
    async for a in db.articles.find({}):
        upd = {f: to_2027(a.get(f) or "") for f in ("slug", "title", "excerpt", "content")}
        if isinstance(a.get("seo"), dict):
            upd["seo"] = _seo(a["seo"])
        upd["tags"] = [to_2027(t) for t in a.get("tags") or []]
        await db.articles.update_one({"_id": a["_id"]}, {"$set": upd})
    await db.settings.update_one({"key": TEXT_FLAG}, {"$set": {"key": TEXT_FLAG, "done": True}}, upsert=True)
