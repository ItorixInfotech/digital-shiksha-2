"""Counsellors CRUD, lead assignment, morning reminders (manual + platform cron)."""
import re
from datetime import timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from lib import counsellors as cs
from lib.cron import accept_cron
from lib import whatsapp as wa
from lib.db import db
from models.content import Lead
from models.counsellor import (
    Counsellor, CounsellorIn, CounsellorSettings, CounsellorSettingsIn, CounsellorWithStats,
    LeadAssignIn, ReminderRecipient, ReminderRun,
)
from routers.admin import require_admin

router = APIRouter()
SID_RE = re.compile(r"^HX[0-9a-fA-F]{32}$")


async def _settings_out() -> CounsellorSettings:
    s = await cs.get_settings()
    sids = await wa.template_sids()
    return CounsellorSettings(auto_assign=bool(s.get("auto_assign")), reminder_template_sid=sids.get("reminder", ""),
                              last_reminder=s.get("last_reminder", "not sent yet"), fallback_numbers=wa.alert_numbers())


@router.get("/admin/counsellors", response_model=List[CounsellorWithStats])
async def list_counsellors(_: str = Depends(require_admin)):
    docs = await db.counsellors.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    counts = {r["_id"]: r for r in await db.leads.aggregate([
        {"$match": {"counsellor_id": {"$ne": None}}},
        {"$group": {"_id": "$counsellor_id", "total": {"$sum": 1}, "new": {"$sum": {"$cond": [{"$eq": ["$status", "New"]}, 1, 0]}}}},
    ]).to_list(500)}
    return [CounsellorWithStats(**d, total_leads=counts.get(d["id"], {}).get("total", 0), new_leads=counts.get(d["id"], {}).get("new", 0)) for d in docs]


@router.post("/admin/counsellors", response_model=Counsellor, status_code=201)
async def create_counsellor(body: CounsellorIn, _: str = Depends(require_admin)):
    if await db.counsellors.find_one({"phone": body.phone}):
        raise HTTPException(status_code=409, detail="A counsellor with this mobile already exists")
    c = Counsellor(**body.model_dump())
    await db.counsellors.insert_one(c.model_dump())
    return c


@router.put("/admin/counsellors/{id}", response_model=Counsellor)
async def update_counsellor(id: str, body: CounsellorIn, _: str = Depends(require_admin)):
    if await db.counsellors.find_one({"phone": body.phone, "id": {"$ne": id}}):
        raise HTTPException(status_code=409, detail="A counsellor with this mobile already exists")
    doc = await db.counsellors.find_one_and_update({"id": id}, {"$set": body.model_dump()}, {"_id": 0}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    return doc


@router.delete("/admin/counsellors/{id}")
async def delete_counsellor(id: str, _: str = Depends(require_admin)):
    res = await db.counsellors.delete_one({"id": id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Counsellor not found")
    await db.leads.update_many({"counsellor_id": id}, {"$set": {"counsellor_id": None}})
    return {"ok": True}


@router.get("/admin/counsellor-settings", response_model=CounsellorSettings)
async def get_settings(_: str = Depends(require_admin)):
    return await _settings_out()


@router.put("/admin/counsellor-settings", response_model=CounsellorSettings)
async def save_settings(body: CounsellorSettingsIn, _: str = Depends(require_admin)):
    sid = body.reminder_template_sid.strip()
    if sid and not SID_RE.match(sid):
        raise HTTPException(status_code=422, detail="Reminder template SID must look like HX followed by 32 characters")
    await db.settings.update_one({"key": cs.SETTINGS_KEY}, {"$set": {"auto_assign": body.auto_assign}}, upsert=True)
    await db.settings.update_one({"key": "whatsapp_templates"}, {"$set": {"key": "whatsapp_templates", "reminder": sid}}, upsert=True)
    return await _settings_out()


@router.patch("/admin/leads/{id}/assign", response_model=Lead)
async def assign_lead(id: str, body: LeadAssignIn, background: BackgroundTasks, _: str = Depends(require_admin)):
    if body.counsellor_id and not await db.counsellors.find_one({"id": body.counsellor_id}):
        raise HTTPException(status_code=404, detail="Counsellor not found")
    doc = await db.leads.find_one_and_update({"id": id}, {"$set": {"counsellor_id": body.counsellor_id}}, {"_id": 0}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Lead not found")
    if doc["created_at"].tzinfo is None:
        doc["created_at"] = doc["created_at"].replace(tzinfo=timezone.utc)
    if body.counsellor_id and body.notify:
        background.add_task(cs.alert_lead, dict(doc), False)  # owner already got the original email
    return doc


async def _queue_reminders(background: BackgroundTasks, trigger: str) -> ReminderRun:
    groups = await cs.build_reminders()
    if groups:
        background.add_task(cs.send_reminders, groups, trigger)
    return ReminderRun(queued=bool(groups), total_leads=sum(len(g["leads"]) for g in groups),
                       recipients=[ReminderRecipient(name=g["name"], to=", ".join(g["to"]) or "-", leads=len(g["leads"])) for g in groups])


@router.post("/admin/reminders/send", response_model=ReminderRun)
async def send_now(background: BackgroundTasks, _: str = Depends(require_admin)):
    return await _queue_reminders(background, "manual")


@router.post("/cron/morning-reminders", status_code=202)
async def cron_morning_reminders(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    early = await accept_cron(request, "morning-reminders")
    if early is not None:
        return early
    async def job():
        groups = await cs.build_reminders()
        if groups:
            await cs.send_reminders(groups, "8 AM schedule")

    background.add_task(job)
    return {"ok": True}
