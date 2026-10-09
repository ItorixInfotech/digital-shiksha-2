"""Admin WhatsApp settings: template SIDs, approval status, test messages."""
import os
import re
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lib import whatsapp as wa
from lib.db import db
from models.predictor import PredictorIn
from routers.admin import require_admin

router = APIRouter()
SID_RE = re.compile(r"^HX[0-9a-fA-F]{32}$")


class TemplateInfo(BaseModel):
    sid: str
    status: str  # approved | pending | received | rejected | not_submitted | not_found | unavailable | unknown
    name: str = ""
    body: str = ""
    variables: int = 0
    rejection_reason: str = ""
    note: str = ""
    checked_at: Optional[datetime] = None
    in_use: bool = False


class WhatsAppPanel(BaseModel):
    configured: bool
    sender: str
    alert_to: list[str]
    lead: Optional[TemplateInfo]
    student: Optional[TemplateInfo]
    sample_available: bool
    last_lead: str
    last_student: str


class TemplateSidsIn(BaseModel):
    lead_sid: str = ""
    student_sid: str = ""


class TestIn(BaseModel):
    kind: Literal["sample", "lead", "student"]


class TestOut(BaseModel):
    ok: bool
    message_sid: str
    detail: str
    used_template: str
    to: str


class MessageStatus(BaseModel):
    status: str
    error: str


async def _panel(refresh: bool = False) -> WhatsAppPanel:
    sids = await wa.template_sids()
    st = await wa.whatsapp_status()
    out = {}
    for kind in ("lead", "student"):
        info = await wa.template_info(sids[kind], refresh=refresh)
        if info:
            info["in_use"] = bool(await wa.effective_template(kind)) and info.get("status") == "approved"
            out[kind] = TemplateInfo(**{k: v for k, v in info.items() if k in TemplateInfo.model_fields})
        else:
            out[kind] = None
    return WhatsAppPanel(
        configured=wa.whatsapp_configured(), sender=os.environ.get("TWILIO_WHATSAPP_FROM", ""), alert_to=wa.alert_numbers(),
        lead=out["lead"], student=out["student"], sample_available=bool(os.environ.get("TWILIO_SAMPLE_TEMPLATE_SID")),
        last_lead=st["last_lead"], last_student=st["last_student"],
    )


@router.get("/admin/whatsapp", response_model=WhatsAppPanel)
async def get_panel(_: str = Depends(require_admin)):
    return await _panel()


@router.post("/admin/whatsapp/check", response_model=WhatsAppPanel)
async def recheck(_: str = Depends(require_admin)):
    return await _panel(refresh=True)


@router.put("/admin/whatsapp/templates", response_model=WhatsAppPanel)
async def save_templates(body: TemplateSidsIn, _: str = Depends(require_admin)):
    lead, student = body.lead_sid.strip(), body.student_sid.strip()
    for label, v in (("Lead alert", lead), ("Student list", student)):
        if v and not SID_RE.match(v):
            raise HTTPException(status_code=422, detail=f"{label} template SID must look like HX followed by 32 characters")
    await wa.save_template_sids(lead, student)
    return await _panel(refresh=True)


@router.post("/admin/whatsapp/test", response_model=TestOut)
async def send_test(body: TestIn, _: str = Depends(require_admin)):
    if not wa.whatsapp_configured():
        raise HTTPException(status_code=400, detail="Twilio WhatsApp is not configured")
    to = wa.alert_numbers()[0]
    if body.kind == "sample":
        tpl = os.environ.get("TWILIO_SAMPLE_TEMPLATE_SID", "")
        if not tpl:
            raise HTTPException(status_code=400, detail="No Twilio sample template configured")
        text, variables = "", {}
    elif body.kind == "lead":
        tpl = await wa.effective_template("lead")
        text, variables = wa.lead_payload({"name": "Test Student", "phone": "9876543210", "city": "Pune", "course_interest": "B.Tech",
                                           "college": "COEP Pune", "message": "This is a TEST alert from the admin panel", "source": "admin-test"})
    else:
        from routers.predictor import run_prediction
        pred = {"exam": "MHT CET", "score": 97.0, "category": "General", "cities": ["Pune", "Mumbai"]}
        out = await run_prediction(PredictorIn(**pred))
        tpl = await wa.effective_template("student")
        text, variables = wa.student_payload({"name": "Test Student"}, out, pred)
    ok, info = await wa._send(to, text, tpl, variables)
    await db.settings.update_one({"key": "whatsapp_last_test"}, {"$set": {"key": "whatsapp_last_test", "ok": ok, "detail": info}}, upsert=True)
    return TestOut(ok=ok, message_sid=info if ok else "", detail="Accepted by Twilio" if ok else info,
                   used_template=tpl or "none (free-form text)", to=to)


@router.get("/admin/whatsapp/messages/{sid}", response_model=MessageStatus)
async def get_message(sid: str, _: str = Depends(require_admin)):
    if not re.match(r"^(SM|MM)[0-9a-fA-F]{32}$", sid):
        raise HTTPException(status_code=422, detail="Invalid message SID")
    return MessageStatus(**await wa.message_status(sid))
