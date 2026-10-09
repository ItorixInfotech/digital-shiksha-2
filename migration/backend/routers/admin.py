import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Type

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from lib.db import db
from lib.whatsapp import whatsapp_configured, whatsapp_status
from models.content import (
    AdminMe, AdminStats, Article, ArticleIn, College, CollegeIn, Course, CourseIn,
    Exam, ExamIn, Lead, LeadStatusUpdate, LoginIn,
)

router = APIRouter()
COOKIE = "ds_admin"


def _secret() -> str:
    return os.environ["JWT_SECRET"]


async def require_admin(request: Request) -> str:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        data = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expired")
    return data["sub"]


@router.post("/auth/login", response_model=AdminMe)
async def login(body: LoginIn, response: Response):
    ok_user = secrets.compare_digest(body.username, os.environ["ADMIN_USERNAME"])
    ok_pass = secrets.compare_digest(body.password, os.environ["ADMIN_PASSWORD"])
    if not (ok_user and ok_pass):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = jwt.encode(
        {"sub": body.username, "exp": datetime.now(timezone.utc) + timedelta(days=7)}, _secret(), algorithm="HS256"
    )
    # COOKIE_SAMESITE=none only if the frontend and API are on different *sites* (e.g. vercel.app + onrender.com).
    samesite = os.environ.get("COOKIE_SAMESITE", "lax").lower()
    response.set_cookie(COOKIE, token, httponly=True, samesite=samesite if samesite in ("lax", "strict", "none") else "lax",
                        secure=os.environ.get("COOKIE_SECURE", "true").lower() != "false", max_age=7 * 86400, path="/",
                        domain=os.environ.get("COOKIE_DOMAIN") or None)
    return AdminMe(username=body.username)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/", domain=os.environ.get("COOKIE_DOMAIN") or None)
    return {"ok": True}


@router.get("/auth/me", response_model=AdminMe)
async def me(user: str = Depends(require_admin)):
    return AdminMe(username=user)


@router.get("/admin/stats", response_model=AdminStats)
async def stats(_: str = Depends(require_admin)):
    return AdminStats(
        leads=await db.leads.count_documents({}),
        new_leads=await db.leads.count_documents({"status": "New"}),
        colleges=await db.colleges.count_documents({}),
        courses=await db.courses.count_documents({}),
        exams=await db.exams.count_documents({}),
        articles=await db.articles.count_documents({}),
        whatsapp_alerts=whatsapp_configured(),
        whatsapp=await whatsapp_status(),
    )


@router.get("/admin/leads", response_model=List[Lead])
async def list_leads(_: str = Depends(require_admin)):
    docs = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for d in docs:
        if d.get("created_at") and d["created_at"].tzinfo is None:
            d["created_at"] = d["created_at"].replace(tzinfo=timezone.utc)
    return docs


@router.patch("/admin/leads/{id}", response_model=Lead)
async def update_lead(id: str, body: LeadStatusUpdate, _: str = Depends(require_admin)):
    doc = await db.leads.find_one_and_update({"id": id}, {"$set": {"status": body.status}}, {"_id": 0}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Lead not found")
    if doc["created_at"].tzinfo is None:
        doc["created_at"] = doc["created_at"].replace(tzinfo=timezone.utc)
    return doc


@router.delete("/admin/leads/{id}")
async def delete_lead(id: str, _: str = Depends(require_admin)):
    res = await db.leads.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


def _register_crud(name: str, model_in: Type[BaseModel], model: Type[BaseModel]) -> None:
    coll = db[name]

    async def create(body: model_in, _: str = Depends(require_admin)):  # type: ignore[valid-type]
        if await coll.find_one({"slug": body.slug}):
            raise HTTPException(status_code=409, detail="Slug already exists")
        obj = model(**body.model_dump())
        await coll.insert_one(obj.model_dump())
        return obj

    async def update(id: str, body: model_in, _: str = Depends(require_admin)):  # type: ignore[valid-type]
        if await coll.find_one({"slug": body.slug, "id": {"$ne": id}}):
            raise HTTPException(status_code=409, detail="Slug already exists")
        doc = await coll.find_one_and_update({"id": id}, {"$set": body.model_dump()}, {"_id": 0}, return_document=True)
        if not doc:
            raise HTTPException(status_code=404, detail="Not found")
        return doc

    async def delete(id: str, _: str = Depends(require_admin)):
        res = await coll.delete_one({"id": id})
        if not res.deleted_count:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    router.add_api_route(f"/admin/{name}", create, methods=["POST"], response_model=model, status_code=201)
    router.add_api_route(f"/admin/{name}/{{id}}", update, methods=["PUT"], response_model=model)
    router.add_api_route(f"/admin/{name}/{{id}}", delete, methods=["DELETE"])


_register_crud("colleges", CollegeIn, College)
_register_crud("courses", CourseIn, Course)
_register_crud("exams", ExamIn, Exam)
_register_crud("articles", ArticleIn, Article)
