from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response

from lib import cap
from lib.db import db
from lib.pdf import build_prediction_pdf
from models.predictor import (
    Bucket, CapMeta, Category, ExamReport, RoundCutoff, PredictionLog, PredictorExam, PredictorIn, PredictorOut, PredictorReport, PredictorResult,
)
from routers.admin import require_admin

router = APIRouter()

EXAMS = {
    "MHT CET": PredictorExam(name="MHT CET", metric="percentile", min=0, max=100, label="MHT CET percentile", hint="e.g. 97.5 — official CAP Round I–IV cut-offs, 380+ Maharashtra engineering colleges"),
    "MHT CET Pharmacy": PredictorExam(name="MHT CET Pharmacy", metric="percentile", min=0, max=100, label="MHT CET percentile (PCB / PCM)", hint="e.g. 92 — official B.Pharm & Pharm.D CAP Round I–IV cut-offs, 520+ Maharashtra colleges"),
    "JEE Main": PredictorExam(name="JEE Main", metric="percentile", min=0, max=100, label="JEE Main percentile", hint="e.g. 98.2 — All India quota seats in Maharashtra"),
    "NEET UG": PredictorExam(name="NEET UG", metric="score", min=0, max=720, label="NEET UG score (out of 720)", hint="e.g. 610 — MBBS state quota / deemed seats"),
    "MAH MBA CET": PredictorExam(name="MAH MBA CET", metric="percentile", min=0, max=100, label="MAH MBA CET percentile", hint="e.g. 96 — MBA/MMS state CAP"),
    "JEE Advanced": PredictorExam(name="JEE Advanced", metric="rank", min=1, max=250000, label="JEE Advanced rank", hint="e.g. 1500 — IIT seats via JoSAA",
                                  rank_note="Enter your category rank (e.g. OBC-NCL rank) if you selected a reserved category."),
}

# Reserved-category closing cutoffs are estimated from the General Open value (approx. historical gaps).
# percentile: gap to 100 widens by factor; score: points lower; rank: category-rank closing as share of GEN closing.
PCT_FACTOR = {"General": 1.0, "EWS": 1.4, "OBC": 1.6, "SC": 3.5, "ST": 6.0, "VJ": 2.0, "NT1": 2.0, "NT2": 1.9, "NT3": 1.8, "SEBC": 1.6, "TFWS": 1.0}
SCORE_DROP = {"General": 0, "EWS": 10, "OBC": 12, "SC": 70, "ST": 110, "VJ": 20, "NT1": 20, "NT2": 18, "NT3": 16, "SEBC": 12, "TFWS": 0}
RANK_SHARE = {"General": 1.0, "EWS": 0.2, "OBC": 0.45, "SC": 0.25, "ST": 0.12, "VJ": 0.4, "NT1": 0.4, "NT2": 0.42, "NT3": 0.44, "SEBC": 0.45, "TFWS": 1.0}
MAX_RESULTS = 300

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


def _program_filter(program: str) -> dict:
    return {"program": {"$in": [program, None]}} if program == "engineering" else {"program": program}


@router.get("/predictor/cap-meta", response_model=CapMeta)
async def cap_meta(program: str = "engineering"):
    if program not in cap.DATA_FILES:
        raise HTTPException(status_code=400, detail="Unknown program")
    f = _program_filter(program)
    hus = sorted(h for h in await db.cap_cutoffs.distinct("home_university", f) if h and h not in ("Autonomous Institute", "Deemed to be University"))
    n = await db.cap_cutoffs.count_documents(f)
    return CapMeta(available=n > 0, year=2026, source=cap.SOURCE_URL, colleges=len(await db.cap_cutoffs.distinct("college_code", f)) if n else 0,
                   courses=n, home_universities=hus, branch_groups=list(cap.groups_for(program)), categories=cap.CATEGORIES)


async def run_cap_prediction(exam: PredictorExam, body: PredictorIn) -> PredictorOut | None:
    """MHT CET (engineering / pharmacy) on the official CAP cut-offs. Chance uses the Round I closing of the most lenient eligible seat."""
    program = cap.EXAM_PROGRAM[exam.name]
    groups = cap.groups_for(program)
    f: dict = _program_filter(program)
    if body.cities:
        f["city"] = {"$in": body.cities}  # exact city (Karad is not "Pune" even though it's in the Pune CAP region)
    if body.branch_group in groups:
        f["branch_lc"] = {"$regex": groups[body.branch_group]}
    rows = await db.cap_cutoffs.find(f, {"_id": 0}).to_list(5000)
    if not rows and not await db.cap_cutoffs.count_documents(_program_filter(program), limit=1):
        return None
    slugs = {r["college_slug"] for r in rows if r.get("college_slug")}
    site = {c["slug"]: c for c in await db.colleges.find({"slug": {"$in": list(slugs)}}, {"_id": 0}).to_list(100)}
    hu = body.home_university.strip().lower()
    results: List[PredictorResult] = []
    for r in rows:
        codes = cap.seat_codes(body.category, body.ladies, (r.get("home_university", "").lower() == hu) if hu else None)
        rounds: List[RoundCutoff] = []
        for rn in ("1", "2", "3", "4"):
            seats = [(code, *r["rounds"][rn][code]) for code in codes if code in r["rounds"].get(rn, {})]
            if seats:
                code, merit, pct = min(seats, key=lambda s: s[2])
                rounds.append(RoundCutoff(round=int(rn), percentile=pct, merit_no=merit, seat=code))
            else:
                rounds.append(RoundCutoff(round=int(rn)))
        first = next((x for x in rounds if x.percentile is not None), None)
        if not first:
            continue
        ch = chance_for("percentile", body.score, first.percentile)
        if not ch:
            continue
        c = site.get(r.get("college_slug") or "", {})
        results.append(PredictorResult(
            college_slug=r.get("college_slug") or "", college_name=r["college_name"], short_name=c.get("short_name") or r["college_name"],
            city=r["city"], type=r.get("status", ""), image=c.get("image", ""), course=r["branch"],
            cutoff=f"R{first.round} {first.percentile:.2f} percentile ({first.seat})", cutoff_value=first.percentile,
            general_cutoff="—", estimated=False, chance=ch, fees_min=c.get("fees_min", 0), fees_max=c.get("fees_max", 0),
            avg_package=c.get("avg_package", 0), rounds=rounds, seat=first.seat, official=True, course_code=r["course_code"],
        ))
    # Most competitive first (Reach → Medium → best High options); the cap drops only the lowest-cutoff "High" seats.
    results.sort(key=lambda x: -x.cutoff_value)
    return PredictorOut(exam=exam.name, metric=exam.metric, score=body.score, category=body.category, results=results[:MAX_RESULTS],
                        total=len(results), source=f"Official CET Cell CAP cut-offs, {cap.PROGRAM_LABEL[program]} (Rounds I–IV) — {cap.SOURCE_URL}")


async def run_prediction(body: PredictorIn) -> PredictorOut:
    exam = EXAMS.get(body.exam)
    if not exam:
        raise HTTPException(status_code=400, detail="Unsupported exam")
    if not (exam.min <= body.score <= exam.max):
        raise HTTPException(status_code=422, detail=f"{exam.label} must be between {exam.min:g} and {exam.max:g}")
    if exam.name in cap.EXAM_PROGRAM:
        out = await run_cap_prediction(exam, body)
        if out is not None:
            return out
    f: dict = {"cutoffs": {"$elemMatch": {"exam": exam.name, "value": {"$ne": None}}}}
    if body.cities:
        f["city"] = {"$in": body.cities}
    results: List[PredictorResult] = []
    for c in await db.colleges.find(f, {"_id": 0}).to_list(500):
        # Group this exam's rows by branch -> {category: row}
        branches: dict = {}
        for row in c.get("cutoffs", []):
            if row.get("exam") == exam.name and row.get("value") is not None:
                branches.setdefault(row["branch"], {})[row.get("category") or "General"] = row
        for branch, rows in branches.items():
            gen = rows.get("General")
            official = rows.get(body.category)
            if official:  # uploaded/official value for the student's own category
                closing, est = float(official["value"]), False
            elif gen:
                closing, est = category_cutoff(exam.metric, float(gen["value"]), body.category), True
            else:
                continue
            ch = chance_for(exam.metric, body.score, closing)
            if not ch:
                continue
            label = fmt(exam.metric, closing)
            results.append(PredictorResult(
                college_slug=c["slug"], college_name=c["name"], short_name=c.get("short_name") or c["name"],
                city=c["city"], type=c.get("type", ""), image=c.get("image", ""), course=branch,
                cutoff=(f"≈ {label} ({body.category})" if est else label),
                cutoff_value=closing, general_cutoff=gen["cutoff"] if gen else "—", estimated=est, chance=ch,
                fees_min=c.get("fees_min", 0), fees_max=c.get("fees_max", 0), avg_package=c.get("avg_package", 0),
            ))
    order = {"High": 0, "Medium": 1, "Reach": 2}
    sign = 1 if exam.metric == "rank" else -1  # most competitive first
    results.sort(key=lambda r: (order[r.chance], sign * r.cutoff_value))
    return PredictorOut(exam=exam.name, metric=exam.metric, score=body.score, category=body.category, results=results[:MAX_RESULTS], total=len(results))


@router.post("/predictor", response_model=PredictorOut)
async def predict(body: PredictorIn):
    out = await run_prediction(body)
    await db.predictions.insert_one(PredictionLog(
        exam=out.exam, metric=out.metric, score=out.score, category=out.category, cities=body.cities,
        results=out.total or len(out.results), high=sum(r.chance == "High" for r in out.results),
    ).model_dump())
    return out


@router.get("/predictor/pdf")
async def predictor_pdf(exam: str, score: float, category: Category = "General", cities: str = "", ladies: bool = False,
                        home_university: str = "", branch_group: str = ""):
    body = PredictorIn(exam=exam, score=score, category=category, cities=[c for c in cities.split(",") if c],
                       ladies=ladies, home_university=home_university, branch_group=branch_group)
    out = await run_prediction(body)
    pdf = build_prediction_pdf(out, body.cities)
    name = f"digital-shiksha-{out.exam.lower().replace(' ', '-')}-{out.score:g}-prediction.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})


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
