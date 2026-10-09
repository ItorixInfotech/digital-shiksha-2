from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.predictor import PredictorExam, PredictorIn, PredictorOut, PredictorResult

router = APIRouter()

EXAMS = {
    "MHT CET": PredictorExam(name="MHT CET", metric="percentile", min=0, max=100, label="MHT CET percentile", hint="e.g. 97.5 — Maharashtra state quota (CAP)"),
    "JEE Main": PredictorExam(name="JEE Main", metric="percentile", min=0, max=100, label="JEE Main percentile", hint="e.g. 98.2 — All India quota seats in Maharashtra"),
    "NEET UG": PredictorExam(name="NEET UG", metric="score", min=0, max=720, label="NEET UG score (out of 720)", hint="e.g. 610 — MBBS state quota / deemed seats"),
    "MAH MBA CET": PredictorExam(name="MAH MBA CET", metric="percentile", min=0, max=100, label="MAH MBA CET percentile", hint="e.g. 96 — MBA/MMS state CAP"),
    "JEE Advanced": PredictorExam(name="JEE Advanced", metric="rank", min=1, max=250000, label="JEE Advanced CRL rank", hint="e.g. 1500 — IIT seats via JoSAA"),
}

# (high-chance margin, medium, reach) — how far below the closing cutoff a candidate can be
MARGINS = {"percentile": (0.0, 0.8, 2.0), "score": (0.0, 15.0, 35.0)}


def chance_for(metric: str, score: float, closing: float) -> str | None:
    if metric == "rank":  # lower is better
        if score <= closing:
            return "High"
        if score <= closing * 1.15:
            return "Medium"
        if score <= closing * 1.4:
            return "Reach"
        return None
    _, med, reach = MARGINS[metric]
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
    if body.city:
        f["city"] = body.city
    results: List[PredictorResult] = []
    for c in await db.colleges.find(f, {"_id": 0}).to_list(500):
        for row in c.get("cutoffs", []):
            if row.get("exam") != exam.name or row.get("value") is None:
                continue
            ch = chance_for(exam.metric, body.score, float(row["value"]))
            if ch:
                results.append(PredictorResult(
                    college_slug=c["slug"], college_name=c["name"], short_name=c.get("short_name") or c["name"],
                    city=c["city"], type=c.get("type", ""), image=c.get("image", ""), course=row["branch"],
                    cutoff=row["cutoff"], cutoff_value=float(row["value"]), chance=ch,
                    fees_min=c.get("fees_min", 0), fees_max=c.get("fees_max", 0), avg_package=c.get("avg_package", 0),
                ))
    order = {"High": 0, "Medium": 1, "Reach": 2}
    reverse = -1 if exam.metric == "rank" else 1
    results.sort(key=lambda r: (order[r.chance], -reverse * r.cutoff_value))
    return PredictorOut(exam=exam.name, metric=exam.metric, score=body.score, results=results)
