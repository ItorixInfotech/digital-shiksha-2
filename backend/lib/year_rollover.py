"""One-time content rollover to the 2027 admission season (idempotent, guarded by a settings flag).

Exams: every year in exam_date / application_deadline / overview moves +1 (so a 2027 exam keeps a realistic
late-2026 application deadline). Articles + SEO text: "2026" -> "2027" (slugs too; old slugs still resolve).
Article published_at dates are real publish dates and are left untouched.
"""
import re

from lib.db import db

ADMISSION_YEAR = 2027  # admission season the site talks about (SEO keywords/scoring use this)
FLAG = "year_rollover_2027"
TEXT_FLAG = "year_rollover_2027_text"
_YEAR = re.compile(r"\b(2025|2026)\b")


def shift_years(s: str) -> str:
    return _YEAR.sub(lambda m: str(int(m.group(1)) + 1), s)


def to_2027(s: str) -> str:
    return s.replace("2026", "2027")


def _seo(seo: dict | None) -> dict | None:
    if not isinstance(seo, dict):
        return seo
    return {k: to_2027(v) if isinstance(v, str) else [to_2027(x) if isinstance(x, str) else x for x in v] if isinstance(v, list) else v
            for k, v in seo.items()}


async def run_year_rollover() -> None:
    if not await db.settings.find_one({"key": FLAG}):  # date shift is not idempotent: run exactly once
        async for e in db.exams.find({}):
            await db.exams.update_one({"_id": e["_id"]}, {"$set": {f: shift_years(e.get(f) or "") for f in ("exam_date", "application_deadline", "overview")}})
        await db.settings.update_one({"key": FLAG}, {"$set": {"key": FLAG, "done": True}}, upsert=True)
    if await db.settings.find_one({"key": TEXT_FLAG}):
        return
    for coll in ("colleges", "courses"):
        async for d in db[coll].find({"seo": {"$type": "object"}}, {"seo": 1}):
            await db[coll].update_one({"_id": d["_id"]}, {"$set": {"seo": _seo(d.get("seo"))}})
    async for e in db.exams.find({}):
        upd: dict = {"seo": _seo(e["seo"])} if isinstance(e.get("seo"), dict) else {}
        upd["faqs"] = [{**q, "question": to_2027(q.get("question", "")), "answer": to_2027(q.get("answer", ""))} for q in e.get("faqs") or []]
        await db.exams.update_one({"_id": e["_id"]}, {"$set": upd})
    async for a in db.articles.find({}):
        upd = {f: to_2027(a.get(f) or "") for f in ("slug", "title", "excerpt", "content")}
        if isinstance(a.get("seo"), dict):
            upd["seo"] = _seo(a["seo"])
        upd["tags"] = [to_2027(t) for t in a.get("tags") or []]
        await db.articles.update_one({"_id": a["_id"]}, {"$set": upd})
    await db.settings.update_one({"key": TEXT_FLAG}, {"$set": {"key": TEXT_FLAG, "done": True}}, upsert=True)
