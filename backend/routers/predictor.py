from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from models.predictor import (
    Bucket, ExamReport, PredictionLog, PredictorExam, PredictorIn, PredictorOut, PredictorReport, PredictorResult,
)
from routers.admin import require_admin

router = APIRouter()

EXAMS = {
    "MHT CET": PredictorExam(name="MHT CET", metric="percentile", min=0, max=100, label="MHT CET percentile", hint="e.g. 97.5 — Maharashtra state quota (CAP)"),
    "JEE Main": PredictorExam(name="JEE Main", metric="percentile", min=0, max=100, label="JEE Main percentile", hint="e.g. 98.2 — All India quota seats in Maharashtra"),
    "NEET UG": PredictorExam(name="NEET UG", metric="score", min=0, max=720, label="NEET UG score (out of 720)", hint="e.g. 610 — MBBS state quota / deemed seats"),
    "MAH MBA CET": PredictorExam(name="MAH MBA CET", metric="percentile", min=0, max=100, label="MAH MBA CET percentile", hint="e.g. 96 — MBA/MMS state CAP"),
    "JEE Advanced": PredictorExam(name="JEE Advanced", metric="rank", min=1, max=250000, label="JEE Advanced rank", hint="e.g. 1500 — IIT seats via JoSAA",
                                  rank_note="Enter your category rank (e.g. OBC-NCL rank) if you selected a reserved category."),
}

# Reserved-category closing cutoffs are estimated from the General Open value (approx. historical gaps).
# percentile: gap to 100 widens by factor; score: points lower; rank: category-rank closing as share of GEN closing.
PCT_FACTOR = {"General": 1.0, "EWS": 1.4, "OBC": 1.6, "SC": 3.5, "ST": 6.0}
SCORE_DROP = {"General": 0, "EWS": 10, "OBC": 12, "SC": 70, "ST": 110}
RANK_SHARE = {"General": 1.0, "EWS": 0.2, "OBC": 0.45, "SC": 0.25, "ST": 0.12}

MARGINS = {"percentile": (0.8, 2.0), "score": (15.0, 35.0)}


def category_cutoff(metric: str, general: float, category: str) -> float:
    if metric == "percentile":
        return round(max(0.0, 100 - (100 - general) * PCT_FACTOR[category]), 2)
    if metric == "score":
        return max(0.0, general - SCORE_DROP[category])
    return max(1.0, round(general * RANK_SHARE[category]))


def fmt(metric: str, v: float) -> str:
    if metric == "rank":
        return f"Closing rank {int(v)}"
    if metric == "score":
        return f"{int(v)} / 720"
    return f"{v:.2f} percentile"


def chance_for(metric: str, score: float, closing: float) -> str | None:
    if metric == "rank":  # lower is better
        if score <= closing:
            return "High"
        if score <= closing * 1.15:
            return "Medium"
        if score <= closing * 1.4:
            return "Reach"
        return None
    med, reach = MARGINS[metric]
    if score >= closing:
        return "High"
    if score >= closing - med:
        return "Medium"
    if score >= closing - reach:
        return "Reach"
    return None


@router.get("/predictor/exams", response_model=List[PredictorExam])
async def predictor_exams():
    return list(EXAMS.values())


@router.post("/predictor", response_model=PredictorOut)
async def predict(body: PredictorIn):
    exam = EXAMS.get(body.exam)
    if not exam:
        raise HTTPException(status_code=400, detail="Unsupported exam")
    if not (exam.min <= body.score <= exam.max):
        raise HTTPException(status_code=422, detail=f"{exam.label} must be between {exam.min:g} and {exam.max:g}")
    f: dict = {"cutoffs": {"$elemMatch": {"exam": exam.name, "value": {"$ne": None}}}}
    if body.cities:
        f["city"] = {"$in": body.cities}
    est = body.category != "General"
    results: List[PredictorResult] = []
    for c in await db.colleges.find(f, {"_id": 0}).to_list(500):
        for row in c.get("cutoffs", []):
            if row.get("exam") != exam.name or row.get("value") is None:
                continue
            general = float(row["value"])
            closing = category_cutoff(exam.metric, general, body.category)
            ch = chance_for(exam.metric, body.score, closing)
            if ch:
                results.append(PredictorResult(
                    college_slug=c["slug"], college_name=c["name"], short_name=c.get("short_name") or c["name"],
                    city=c["city"], type=c.get("type", ""), image=c.get("image", ""), course=row["branch"],
                    cutoff=(f"≈ {fmt(exam.metric, closing)} ({body.category})" if est else row["cutoff"]),
                    cutoff_value=closing, general_cutoff=row["cutoff"], estimated=est, chance=ch,
                    fees_min=c.get("fees_min", 0), fees_max=c.get("fees_max", 0), avg_package=c.get("avg_package", 0),
                ))
    order = {"High": 0, "Medium": 1, "Reach": 2}
    sign = 1 if exam.metric == "rank" else -1  # most competitive first
    results.sort(key=lambda r: (order[r.chance], sign * r.cutoff_value))
    await db.predictions.insert_one(PredictionLog(
        exam=exam.name, metric=exam.metric, score=body.score, category=body.category, cities=body.cities,
        results=len(results), high=sum(r.chance == "High" for r in results),
    ).model_dump())
    return PredictorOut(exam=exam.name, metric=exam.metric, score=body.score, category=body.category, results=results)


BUCKETS = {
    "percentile": [(0, 90, "< 90"), (90, 95, "90–95"), (95, 98, "95–98"), (98, 99, "98–99"), (99, 101, "99+")],
    "score": [(0, 450, "< 450"), (450, 550, "450–549"), (550, 620, "550–619"), (620, 660, "620–659"), (660, 721, "660+")],
    "rank": [(0, 1000, "< 1K"), (1000, 5000, "1K–5K"), (5000, 15000, "5K–15K"), (15000, 10**7, "15K+")],
}


def _aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


@router.get("/admin/predictor-report", response_model=PredictorReport)
async def predictor_report(_: str = Depends(require_admin)):
    logs = await db.predictions.find({}, {"_id": 0}).sort("created_at", -1).to_list(20000)
    for d in logs:
        d["created_at"] = _aware(d["created_at"])
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    exams: List[ExamReport] = []
    for name, spec in EXAMS.items():
        rows = [d for d in logs if d["exam"] == name]
        cats: dict = {}
        for d in rows:
            cats[d["category"]] = cats.get(d["category"], 0) + 1
        exams.append(ExamReport(
            exam=name, metric=spec.metric, searches=len(rows),
            avg_score=round(sum(d["score"] for d in rows) / len(rows), 2) if rows else 0,
            buckets=[Bucket(label=lbl, count=sum(lo <= d["score"] < hi for d in rows)) for lo, hi, lbl in BUCKETS[spec.metric]],
            categories=cats,
        ))
    exams.sort(key=lambda e: -e.searches)
    return PredictorReport(
        total_searches=len(logs),
        last_7_days=sum(d["created_at"] >= week_ago for d in logs),
        predictor_leads=await db.leads.count_documents({"source": "predictor"}),
        exams=exams,
        recent=[PredictionLog(**d) for d in logs[:50]],
    )
