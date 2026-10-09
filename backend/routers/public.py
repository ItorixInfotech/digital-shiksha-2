import re
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from lib.db import db
from lib.email import notify_new_lead, send_student_confirmation
from models.content import (
    Article, College, Course, Exam, FacetCount, Lead, LeadIn, Meta, SearchHit,
)

router = APIRouter()


def _rx(q: str) -> dict:
    return {"$regex": re.escape(q.strip()), "$options": "i"}


async def _one(coll: str, slug: str) -> dict:
    doc = await db[coll].find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@router.get("/colleges", response_model=List[College])
async def list_colleges(
    q: Optional[str] = None,
    stream: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    type: Optional[str] = None,
    max_fees: Optional[int] = None,
    featured: Optional[bool] = None,
    sort: str = "rank",
    limit: int = Query(200, le=500),
):
    f: dict = {}
    if q:
        f["$or"] = [{"name": _rx(q)}, {"short_name": _rx(q)}, {"city": _rx(q)}]
    if stream:
        f["streams"] = stream
    if city:
        f["city"] = city
    if state:
        f["state"] = state
    if type:
        f["type"] = type
    if max_fees:
        f["fees_min"] = {"$lte": max_fees}
    if featured is not None:
        f["featured"] = featured
    docs = await db.colleges.find(f, {"_id": 0}).to_list(limit)
    key = {
        "rank": lambda d: d.get("nirf_rank") or 9999,
        "fees": lambda d: d.get("fees_min") or 0,
        "package": lambda d: -(d.get("avg_package") or 0),
        "rating": lambda d: -(d.get("rating") or 0),
    }.get(sort, lambda d: d.get("nirf_rank") or 9999)
    return sorted(docs, key=key)


@router.get("/colleges/{slug}", response_model=College)
async def get_college(slug: str):
    return await _one("colleges", slug)


@router.get("/courses", response_model=List[Course])
async def list_courses(stream: Optional[str] = None, level: Optional[str] = None, q: Optional[str] = None):
    f: dict = {}
    if stream:
        f["stream"] = stream
    if level:
        f["level"] = level
    if q:
        f["$or"] = [{"name": _rx(q)}, {"full_name": _rx(q)}]
    return await db.courses.find(f, {"_id": 0}).sort("name", 1).to_list(500)


@router.get("/courses/{slug}", response_model=Course)
async def get_course(slug: str):
    return await _one("courses", slug)


@router.get("/exams", response_model=List[Exam])
async def list_exams(stream: Optional[str] = None, level: Optional[str] = None, q: Optional[str] = None):
    f: dict = {}
    if stream:
        f["stream"] = stream
    if level:
        f["level"] = level
    if q:
        f["$or"] = [{"name": _rx(q)}, {"full_name": _rx(q)}]
    return await db.exams.find(f, {"_id": 0}).sort("name", 1).to_list(500)


@router.get("/exams/{slug}", response_model=Exam)
async def get_exam(slug: str):
    return await _one("exams", slug)


@router.get("/articles", response_model=List[Article])
async def list_articles(category: Optional[str] = None, q: Optional[str] = None):
    f: dict = {}
    if category:
        f["category"] = category
    if q:
        f["title"] = _rx(q)
    return await db.articles.find(f, {"_id": 0}).sort("published_at", -1).to_list(500)


@router.get("/articles/{slug}", response_model=Article)
async def get_article(slug: str):
    return await _one("articles", slug)


@router.get("/search", response_model=List[SearchHit])
async def search(q: str = Query(..., min_length=1)):
    hits: List[SearchHit] = []
    for d in await db.courses.find({"$or": [{"name": _rx(q)}, {"full_name": _rx(q)}]}, {"_id": 0}).to_list(5):
        hits.append(SearchHit(kind="course", slug=d["slug"], title=d["name"], subtitle=d.get("full_name") or d["stream"]))
    for d in await db.exams.find({"$or": [{"name": _rx(q)}, {"full_name": _rx(q)}]}, {"_id": 0}).to_list(5):
        hits.append(SearchHit(kind="exam", slug=d["slug"], title=d["name"], subtitle=d.get("full_name") or d["stream"]))
    for d in await db.colleges.find({"$or": [{"name": _rx(q)}, {"short_name": _rx(q)}]}, {"_id": 0}).to_list(6):
        hits.append(SearchHit(kind="college", slug=d["slug"], title=d["name"], subtitle=f"{d['city']}, {d['state']}"))
    return hits


async def _facet(field: str, unwind: bool = False) -> List[FacetCount]:
    pipe: list = [{"$unwind": f"${field}"}] if unwind else []
    pipe += [{"$group": {"_id": f"${field}", "count": {"$sum": 1}}}, {"$sort": {"count": -1, "_id": 1}}]
    rows = await db.colleges.aggregate(pipe).to_list(200)
    return [FacetCount(name=r["_id"], count=r["count"]) for r in rows if r["_id"]]


@router.get("/meta", response_model=Meta)
async def meta():
    return Meta(
        streams=await _facet("streams", unwind=True),
        cities=await _facet("city"),
        states=await _facet("state"),
        types=await _facet("type"),
        totals={
            "colleges": await db.colleges.count_documents({}),
            "courses": await db.courses.count_documents({}),
            "exams": await db.exams.count_documents({}),
            "articles": await db.articles.count_documents({}),
        },
    )


@router.post("/enquiries", response_model=Lead, status_code=201)
async def create_enquiry(body: LeadIn, background: BackgroundTasks):
    lead = Lead(**body.model_dump())
    # Same phone within 10 min = duplicate submit: still saved, but no second alert email.
    recent = await db.leads.find_one({"phone": lead.phone, "created_at": {"$gte": lead.created_at - timedelta(minutes=10)}})
    # Student thank-you: at most one per email address per 24 h (abuse guard for a public form).
    confirm = bool(lead.email) and not await db.leads.find_one(
        {"email": lead.email, "created_at": {"$gte": lead.created_at - timedelta(hours=24)}})
    await db.leads.insert_one(lead.model_dump())
    if not recent:
        background.add_task(notify_new_lead, lead.model_dump())
    if confirm:
        background.add_task(send_student_confirmation, lead.model_dump())
    return lead
