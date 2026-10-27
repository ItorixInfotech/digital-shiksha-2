import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Type

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from lib import admin_auth, login_guard
from lib.db import db
from lib.email import send_admin_reset
from lib.whatsapp import whatsapp_configured, whatsapp_status
from models.content import (
    AdminMe, AdminStats, Article, ForgotOut, ResetIn, ArticleIn, College, CollegeIn, Course, CourseIn,
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
    if data.get("pv", 0) != await admin_auth.session_version():  # password was reset since this session started
        raise HTTPException(status_code=401, detail="Session expired")
    return data["sub"]


@router.post("/auth/login", response_model=AdminMe)
async def login(body: LoginIn, request: Request, response: Response):
    ip = login_guard.client_ip(request)
    await login_guard.check_locked(ip)  # 429 while locked, even for the right password
    ok_user = secrets.compare_digest(body.username, os.environ["ADMIN_USERNAME"])
    ok_pass = await admin_auth.password_ok(body.password)
    if not (ok_user and ok_pass):
        await login_guard.record_failure(ip, ok_user)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    await login_guard.record_success(ip)
    token = jwt.encode(
        {"sub": body.username, "pv": await admin_auth.session_version(), "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        _secret(), algorithm="HS256"
    )
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=True, max_age=7 * 86400, path="/")
    return AdminMe(username=body.username)


def _mask(email: str) -> str:
    user, _, domain = email.partition("@")
    return f"{user[:1]}{'*' * max(len(user) - 1, 3)}@{domain}" if domain else ""


@router.post("/auth/forgot", response_model=ForgotOut, status_code=202)
async def forgot_password():
    """Emails a 30-minute single-use reset link (with the admin username) to the fixed owner inbox LEAD_ALERT_EMAIL only."""
    to = os.environ.get("LEAD_ALERT_EMAIL", "")
    if not to:
        raise HTTPException(status_code=503, detail="No admin inbox is set up for password reset")
    token = await admin_auth.create_reset_token()
    if token is None:
        raise HTTPException(status_code=429, detail="A reset link was just sent — please check the inbox or wait 2 minutes")
    base = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
    if not base.startswith("https://") or not await send_admin_reset(to, os.environ["ADMIN_USERNAME"], f"{base}/admin/reset?token={token}"):
        raise HTTPException(status_code=502, detail="Could not send the reset email — please try again")
    return ForgotOut(sent_to=_mask(to))


@router.post("/auth/reset")
async def reset_password(body: ResetIn, response: Response):
    if not await admin_auth.reset_password(body.token, body.password):
        raise HTTPException(status_code=400, detail="This reset link is invalid, already used or expired — request a new one")
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
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
        for k in ("created_at", "alert_email_at"):  # Mongo returns naive UTC datetimes
            if d.get(k) and d[k].tzinfo is None:
                d[k] = d[k].replace(tzinfo=timezone.utc)
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
