from datetime import datetime, timedelta, timezone
from typing import List

import io
import secrets
import zipfile

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pymongo.errors import DuplicateKeyError

from lib import cap, kcet, razorpay
import os

from lib.email import notify_payment, send_predictor_receipt
from lib.whatsapp import notify_payment_whatsapp, send_student_prediction
from lib.db import db
from lib.pdf import build_prediction_pdf
from models.predictor import (
    PredictionLogIn, RazorpayStatus,
    Bucket, CapMeta, Category, ExamReport, RoundCutoff, PredictionLog, PredictorExam, PredictorIn, PredictorOut, PredictorReport, PredictorResult,
    PaymentRecord, PredictorAccess, UnlockIn, UnlockOut,
)
from routers.admin import require_admin

router = APIRouter()

EXAMS = {
    "MHT CET": PredictorExam(name="MHT CET", metric="percentile", min=0, max=100, label="MHT CET percentile", hint="e.g. 97.5 — official CAP Round I–IV cut-offs, 380+ Maharashtra engineering colleges",
                            fee=razorpay.PAID_EXAMS["MHT CET"][0] // 100, payment_link=razorpay.PAID_EXAMS["MHT CET"][1]),
    "MHT CET Pharmacy": PredictorExam(name="MHT CET Pharmacy", metric="percentile", min=0, max=100, label="MHT CET percentile (PCB / PCM)", hint="e.g. 92 — official B.Pharm & Pharm.D CAP Round I–IV cut-offs, 520+ Maharashtra colleges",
                                     fee=razorpay.PAID_EXAMS["MHT CET Pharmacy"][0] // 100, payment_link=razorpay.PAID_EXAMS["MHT CET Pharmacy"][1]),
    "JEE Main": PredictorExam(name="JEE Main", metric="percentile", min=0, max=100, label="JEE Main percentile", hint="e.g. 98.2 — All India quota seats in Maharashtra",
                              fee=razorpay.PAID_EXAMS["JEE Main"][0] // 100, payment_link=razorpay.PAID_EXAMS["JEE Main"][1]),
    "NEET UG": PredictorExam(name="NEET UG", metric="score", min=0, max=720, label="NEET UG score (out of 720)", hint="e.g. 610 — MBBS state quota / deemed seats",
                             fee=razorpay.PAID_EXAMS["NEET UG"][0] // 100, payment_link=razorpay.PAID_EXAMS["NEET UG"][1]),
    "MAH MBA CET": PredictorExam(name="MAH MBA CET", metric="percentile", min=0, max=100, label="MAH MBA CET percentile", hint="e.g. 96 — MBA/MMS state CAP",
                                 fee=razorpay.PAID_EXAMS["MAH MBA CET"][0] // 100, payment_link=razorpay.PAID_EXAMS["MAH MBA CET"][1]),
    "JEE Advanced": PredictorExam(name="JEE Advanced", metric="rank", min=1, max=250000, label="JEE Advanced rank", hint="e.g. 1500 — IIT seats via JoSAA",
                                  rank_note="Enter your category rank (e.g. OBC-NCL rank) if you selected a reserved category.",
                                  fee=razorpay.PAID_EXAMS["JEE Advanced"][0] // 100, payment_link=razorpay.PAID_EXAMS["JEE Advanced"][1]),
    "KCET": PredictorExam(name="KCET", metric="rank", min=1, max=300000, label="KCET engineering rank", hint="e.g. 15000 — official KEA 2025 Round I closing ranks, 220+ Karnataka engineering colleges",
                          rank_note="Enter your KCET engineering rank — the predictor applies your category seats itself."),
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
        return round(max(0.0, 100 - (100 - general) * PCT_FACTOR.get(category, 1.6)), 2)
    if metric == "score":
        return max(0.0, general - SCORE_DROP.get(category, 12))
    return max(1.0, round(general * RANK_SHARE.get(category, 0.45)))


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
    auto = razorpay.configured()
    return [e.model_copy(update={"payment_auto_check": auto, "fee": await razorpay.exam_fee(e.name) // 100}) if e.fee else e
            for e in EXAMS.values()]


def _program_filter(program: str) -> dict:
    return {"program": {"$in": [program, None]}} if program == "engineering" else {"program": program}


@router.get("/predictor/cap-meta", response_model=CapMeta)
async def cap_meta(program: str = "engineering"):
    if program == "kcet":
        n = await db.kcet_cutoffs.count_documents({})
        cities = await db.kcet_cutoffs.distinct("city")
        return CapMeta(available=n > 0, year=kcet.YEAR, source=kcet.SOURCE_URL, colleges=len(await db.kcet_cutoffs.distinct("college_code")) if n else 0,
                       courses=n, home_universities=[], branch_groups=list(cap.BRANCH_GROUPS), categories=kcet.CATEGORIES,
                       cities=[c for c in kcet.CITIES if c in cities])
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


async def run_kcet_prediction(exam: PredictorExam, body: PredictorIn) -> PredictorOut:
    """KCET on the official KEA closing ranks: best (highest) closing rank among the seat types the student qualifies for."""
    if body.category not in kcet.PREFIX:
        raise HTTPException(status_code=422, detail="Choose a Karnataka category (GM, 1, 2A, 2B, 3A, 3B, SC or ST)")
    f: dict = {}
    if body.cities:
        f["city"] = {"$in": body.cities}
    if body.branch_group in cap.BRANCH_GROUPS:
        f["branch_lc"] = {"$regex": cap.BRANCH_GROUPS[body.branch_group]}
    rows = await db.kcet_cutoffs.find(f, {"_id": 0}).to_list(5000)
    slugs = {r["college_slug"] for r in rows if r.get("college_slug")}
    site = {c["slug"]: c for c in await db.colleges.find({"slug": {"$in": list(slugs)}}, {"_id": 0, "slug": 1, "short_name": 1, "image": 1, "logo": 1,
                                                                                         "fees_min": 1, "fees_max": 1, "avg_package": 1}).to_list(500)}
    codes = kcet.seat_codes(body.category, body.kannada, body.rural)
    results: List[PredictorResult] = []
    for r in rows:
        seats = [(code, r["ranks"][code]) for code in codes if code in r["ranks"]]
        if not seats:
            continue
        seat, closing = max(seats, key=lambda s: s[1])
        ch = chance_for("rank", body.score, closing)
        if not ch:
            continue
        c = site.get(r.get("college_slug") or "", {})
        results.append(PredictorResult(
            college_slug=r.get("college_slug") or "", college_name=r.get("display_name") or r["college_name"], short_name=c.get("short_name") or r.get("display_name") or r["college_name"],
            city=r["city"], type=r.get("type", ""), image=c.get("logo") or c.get("image", ""), course=r["branch"],
            cutoff=f"Closing rank {closing:,} ({seat})", cutoff_value=float(closing), general_cutoff=f"{r['ranks']['GM']:,}" if "GM" in r["ranks"] else "—",
            estimated=False, chance=ch, fees_min=c.get("fees_min", 0), fees_max=c.get("fees_max", 0), avg_package=c.get("avg_package", 0),
            seat=seat, official=True, course_code=r["course_code"],
        ))
    results.sort(key=lambda x: x.cutoff_value)  # most competitive (lowest closing rank) first
    return PredictorOut(exam=exam.name, metric=exam.metric, score=body.score, category=body.category, results=results[:MAX_RESULTS],
                        total=len(results), source=kcet.SOURCE)


async def run_prediction(body: PredictorIn) -> PredictorOut:
    exam = EXAMS.get(body.exam)
    if not exam:
        raise HTTPException(status_code=400, detail="Unsupported exam")
    if not (exam.min <= body.score <= exam.max):
        raise HTTPException(status_code=422, detail=f"{exam.label} must be between {exam.min:g} and {exam.max:g}")
    if exam.name == "KCET":
        return await run_kcet_prediction(exam, body)
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


UNLOCK_COOKIE = "ds_unlocks"  # httpOnly; "."-separated unlock tokens (newest last, max 20)


def _cookie_tokens(request: Request) -> list[str]:
    return [t for t in request.cookies.get(UNLOCK_COOKIE, "").split(".") if t][-20:]


async def _is_unlocked(request: Request, exam: str, score: float) -> bool:
    tokens = _cookie_tokens(request)
    return bool(tokens) and bool(await db.predictor_unlocks.find_one({"token": {"$in": tokens}, "exam": exam, "score": score}, {"_id": 1}))


@router.get("/predictor/access", response_model=PredictorAccess)
async def predictor_access(exam: str, score: float, request: Request):
    return PredictorAccess(paid=exam not in razorpay.PAID_EXAMS or await _is_unlocked(request, exam, score))


async def require_unlock(body: PredictorIn, request: Request) -> None:
    """Paid exams: one verified payment unlocks one exam + score (a new score needs a new payment)."""
    if body.exam not in razorpay.PAID_EXAMS:
        return
    if not await _is_unlocked(request, body.exam, body.score):
        raise HTTPException(status_code=402, detail="Payment required to view this prediction")


@router.post("/predictor/unlock", response_model=UnlockOut)
async def unlock(body: UnlockIn, background: BackgroundTasks, request: Request, response: Response):
    pred = body.prediction
    if pred.exam not in razorpay.PAID_EXAMS:
        raise HTTPException(status_code=400, detail="This exam's predictor is free")
    out = await run_prediction(pred)  # validates exam + score range first
    used_msg = "This payment has already been used for a prediction. Changing your percentile needs a new payment"
    fee = await razorpay.exam_fee(pred.exam)  # live Payment Page price
    verified = razorpay.configured()
    if body.email and await db.predictor_unlocks.count_documents(
            {"email": body.email, "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}}) >= 5:
        raise HTTPException(status_code=429, detail="Too many unlocks for this email today — please call +91 8149 68 9468")
    try:
        if body.payment_id and await db.predictor_unlocks.find_one({"payment_id": body.payment_id}, {"_id": 1}):
            raise razorpay.PaymentError(409, used_msg)
        if not verified:
            # No Razorpay API keys yet: accept the receipt's payment ID once; admin cross-checks it in the Razorpay dashboard.
            if not body.payment_id:
                raise razorpay.PaymentError(422, "Enter the payment ID (pay_…) from your Razorpay receipt")
            payment = {"id": body.payment_id, "amount": fee}
        elif body.payment_id:
            payment = await razorpay.fetch_payment(body.payment_id, fee)
        else:
            used = {d["payment_id"] async for d in db.predictor_unlocks.find({"phone": body.phone}, {"payment_id": 1})}
            payment = await razorpay.find_by_phone(body.phone, used, fee)
    except razorpay.PaymentError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail)
    doc = {"payment_id": payment["id"], "token": secrets.token_urlsafe(24), "exam": pred.exam, "score": pred.score,
           "phone": body.phone, "name": body.name.strip(), "amount": payment["amount"] // 100,
           "payer_contact": payment.get("contact", ""), "payer_email": payment.get("email", ""),
           "prediction": pred.model_dump(), "verified": verified, "created_at": datetime.now(timezone.utc),
           "receipt_id": secrets.token_urlsafe(18), "email": str(payment.get("email") or body.email or ""), "email_sent": False}
    gate = await db.leads.find_one({"phone": body.phone, "role": {"$nin": [None, ""]}}, {"role": 1}, sort=[("created_at", -1)])
    doc["role"] = (gate or {}).get("role", "")  # Parent / Student from the predictor details pop-up
    try:
        await db.predictor_unlocks.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail=used_msg)
    await db.predictions.update_many({"exam": pred.exam, "score": pred.score, "phone": body.phone, "paid": False},
                                     {"$set": {"paid": True, "payment_id": doc["payment_id"]}})
    lead = {"id": doc["payment_id"], "name": doc["name"] or "Student", "phone": body.phone}
    background.add_task(send_student_prediction, lead, out, doc["prediction"])
    background.add_task(_payment_emails, doc, out)
    tokens = (_cookie_tokens(request) + [doc["token"]])[-20:]
    response.set_cookie(UNLOCK_COOKIE, ".".join(tokens), httponly=True, samesite="lax", secure=True, max_age=365 * 86400, path="/api/predictor")
    return UnlockOut(payment_id=doc["payment_id"], exam=pred.exam, score=pred.score, amount=doc["amount"],
                     email=_mask_email(doc["email"]), phone=_mask_phone(doc["payer_contact"] or body.phone),
                     pdf_url=f"/api/predictor/receipt/{doc['receipt_id']}.pdf")


def _mask_email(e: str) -> str:
    user, _, domain = e.partition("@")
    return f"{user[:2]}{'*' * max(len(user) - 2, 3)}@{domain}" if domain else ""


def _mask_phone(p: str) -> str:
    d = "".join(ch for ch in p if ch.isdigit())[-10:]
    return f"+91 {d[:2]}******{d[-2:]}" if len(d) == 10 else ""


async def _payment_emails(doc: dict, out: PredictorOut) -> None:
    """Owner payment alert + student receipt, both linking the prediction PDF (the email service has no attachments)."""
    base = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
    url = f"{base}/api/predictor/receipt/{doc['receipt_id']}.pdf" if base.startswith("https://") else ""
    await notify_payment(doc, out, url)
    await notify_payment_whatsapp(doc, out, url)
    if doc["email"] and await send_predictor_receipt(doc, out, url):
        await db.predictor_unlocks.update_one({"payment_id": doc["payment_id"]}, {"$set": {"email_sent": True}})


@router.get("/predictor/receipt/{receipt_id}.pdf")
async def predictor_receipt_pdf(receipt_id: str):
    """Emailed / step-2 download link: receipt + full college list for the paid percentile."""
    doc = await db.predictor_unlocks.find_one({"receipt_id": receipt_id}, {"_id": 0}) if receipt_id else None
    if not doc:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return await _receipt_pdf(doc)


@router.get("/admin/predictions/{log_id}/pdf")
async def admin_prediction_pdf(log_id: str, _: str = Depends(require_admin)):
    """Any logged prediction (paid or free) re-created as the same PDF the student saw."""
    d = await db.predictions.find_one({"id": log_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Prediction not found")
    body = PredictorIn(**(d.get("params") or {"exam": d["exam"], "score": d["score"], "category": d["category"], "cities": d.get("cities", [])}))
    out = await run_prediction(body)
    name = f"digital-shiksha-{out.exam.lower().replace(' ', '-')}-{out.score:g}-{log_id[:8]}.pdf"
    return Response(content=build_prediction_pdf(out, body.cities), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/admin/razorpay-status", response_model=RazorpayStatus)
async def admin_razorpay_status(_: str = Depends(require_admin)):
    return await razorpay.connection_status()


@router.get("/admin/predictor-payments/pdfs.zip")
async def admin_payment_pdfs_zip(_: str = Depends(require_admin)):
    """Every paid prediction's receipt PDF (latest 200) in one ZIP."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        async for doc in db.predictor_unlocks.find({}, {"_id": 0}).sort("created_at", -1).limit(200):
            res = await _receipt_pdf(doc)
            fname = res.headers["content-disposition"].split('filename="')[1].rstrip('"')
            z.writestr(fname, res.body)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(content=buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="digital-shiksha-paid-predictions-{stamp}.zip"'})


@router.get("/admin/predictor-payments/{payment_id}/pdf")
async def admin_payment_pdf(payment_id: str, _: str = Depends(require_admin)):
    doc = await db.predictor_unlocks.find_one({"payment_id": payment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Payment not found")
    return await _receipt_pdf(doc)


async def _receipt_pdf(doc: dict) -> Response:
    body = PredictorIn(**doc["prediction"])
    out = await run_prediction(body)
    pdf = build_prediction_pdf(out, body.cities, receipt={"name": doc.get("name"), "payment_id": doc["payment_id"],
                                                          "amount": doc.get("amount", 0), "paid_at": _aware(doc["created_at"])})
    name = f"digital-shiksha-{out.exam.lower().replace(' ', '-')}-{out.score:g}-{doc['payment_id']}.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.post("/predictor", response_model=PredictorOut)
async def predict(body: PredictorIn, request: Request):
    await require_unlock(body, request)
    return await run_prediction(body)  # logged separately via /predictor/log (also before payment)


@router.post("/predictor/log", status_code=204)
async def log_prediction(body: PredictionLogIn, request: Request):
    """Every submitted score (paid exams too, before payment) — admin can download its PDF from the Predictor Report."""
    pred = body.prediction
    out = await run_prediction(pred)
    paid_exam = pred.exam in razorpay.PAID_EXAMS
    await db.predictions.insert_one(PredictionLog(
        exam=out.exam, metric=out.metric, score=out.score, category=out.category, cities=pred.cities,
        results=out.total or len(out.results), high=sum(r.chance == "High" for r in out.results), params=pred.model_dump(),
        name=body.name.strip(), phone=body.phone, paid_exam=paid_exam, paid=paid_exam and await _is_unlocked(request, pred.exam, pred.score),
    ).model_dump())


@router.get("/predictor/pdf")
async def predictor_pdf(request: Request, exam: str, score: float, category: Category = "General", cities: str = "", ladies: bool = False,
                        home_university: str = "", branch_group: str = "", kannada: bool = False, rural: bool = False):
    body = PredictorIn(exam=exam, score=score, category=category, cities=[c for c in cities.split(",") if c],
                       ladies=ladies, home_university=home_university, branch_group=branch_group, kannada=kannada, rural=rural)
    await require_unlock(body, request)
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
        recent=[PredictionLog(**d) for d in logs[:200]],
    )


@router.get("/admin/predictor-payments", response_model=List[PaymentRecord])
async def predictor_payments(_: str = Depends(require_admin)):
    rows = await db.predictor_unlocks.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [PaymentRecord(**{**d, "created_at": _aware(d.get("created_at") or datetime.now(timezone.utc)), "verified": d.get("verified", False)}) for d in rows]
