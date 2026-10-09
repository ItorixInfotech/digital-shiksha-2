"""Counsellor routing: round-robin auto-assign, per-counsellor lead alerts, morning "New leads" reminders."""
import logging
import os
from datetime import datetime, timezone
from html import escape

from pymongo import ReturnDocument

from lib import whatsapp as wa
from lib.db import db
from lib.email import notify_new_lead, send_email

logger = logging.getLogger(__name__)
SETTINGS_KEY = "counsellor_settings"
MAX_LINES = 15


async def get_settings() -> dict:
    return await db.settings.find_one({"key": SETTINGS_KEY}, {"_id": 0}) or {}


async def next_counsellor() -> dict | None:
    """Round-robin over active counsellors (oldest first), using an atomic cursor."""
    active = await db.counsellors.find({"active": True}, {"_id": 0}).sort("created_at", 1).to_list(200)
    if not active:
        return None
    doc = await db.settings.find_one_and_update(
        {"key": SETTINGS_KEY}, {"$inc": {"rr_cursor": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return active[(doc.get("rr_cursor", 1) - 1) % len(active)]


async def counsellor_for(lead: dict) -> dict | None:
    if not lead.get("counsellor_id"):
        return None
    return await db.counsellors.find_one({"id": lead["counsellor_id"]}, {"_id": 0})


async def alert_lead(lead: dict, owner_email: bool = True) -> None:
    """New/assigned lead → WhatsApp to the assigned counsellor (else admin number) + email. Never raises."""
    c = await counsellor_for(lead)
    await wa.notify_whatsapp(lead, [f"+91{c['phone']}"] if c else None)
    if owner_email:
        await notify_new_lead(lead)
    if c and c.get("email") and c["email"] != os.environ.get("LEAD_ALERT_EMAIL"):
        await notify_new_lead(lead, to=c["email"])


def _age(created: datetime, now: datetime) -> str:
    created = created.replace(tzinfo=timezone.utc) if created.tzinfo is None else created
    days = (now - created).days
    return "today" if days < 1 else f"{days}d ago"


async def build_reminders() -> list[dict]:
    """Group every 'New' lead by its (active) counsellor; the rest go to the admin numbers."""
    counsellors = {c["id"]: c for c in await db.counsellors.find({"active": True}, {"_id": 0}).to_list(200)}
    leads = await db.leads.find({"status": "New"}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    groups: dict[str, dict] = {}
    for lead in leads:
        c = counsellors.get(lead.get("counsellor_id") or "")
        key = c["id"] if c else "_admin"
        if key not in groups:
            groups[key] = ({"name": c["name"], "to": [f"+91{c['phone']}"], "email": c.get("email") or "", "leads": []} if c
                           else {"name": "Admin (unassigned)", "to": wa.alert_numbers(), "email": os.environ.get("LEAD_ALERT_EMAIL", ""), "leads": []})
        groups[key]["leads"].append(lead)
    return list(groups.values())


def reminder_payload(g: dict) -> tuple[str, dict, list[str]]:
    now = datetime.now(timezone.utc)
    lines = [f"{i + 1}) {l['name']} +91 {l['phone']}" + (f" - {l['course_interest']}" if l.get("course_interest") else "")
             + f" ({_age(l['created_at'], now)})" for i, l in enumerate(g["leads"][:MAX_LINES])]
    more = len(g["leads"]) - MAX_LINES
    if more > 0:
        lines.append(f"+{more} more in the admin panel")
    first = g["name"].split(" ")[0]
    body = (f"Good morning {first}! You have {len(g['leads'])} *New* Digital Shiksha lead(s) not called yet:\n"
            + "\n".join(lines) + "\n\nPlease call them today and update the status in the admin panel.")
    return body, {"1": first, "2": str(len(g["leads"])), "3": "; ".join(lines)}, lines


def reminder_html(g: dict, lines: list[str]) -> str:
    items = "".join(f'<li style="padding:4px 0">{escape(x)}</li>' for x in lines)
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px">'
        '<div style="background:#0a2540;padding:18px 22px;border-radius:12px 12px 0 0;color:#fff;font-size:18px;font-weight:bold">'
        '<span style="color:#f87171">Digital</span> Shiksha <span style="font-size:13px;color:#cbd5e1;font-weight:normal">Morning reminder</span></div>'
        f'<div style="padding:22px;color:#0f172a;font-size:15px"><p>Good morning {escape(g["name"].split(" ")[0])},</p>'
        f'<p>You have <strong>{len(g["leads"])}</strong> lead(s) still in <strong>New</strong> status:</p><ol style="padding-left:18px">{items}</ol>'
        '<p style="color:#64748b;font-size:13px">Please call them today and update the status in the admin panel (Leads tab).</p></div></div>'
    )


async def send_reminders(groups: list[dict], trigger: str) -> None:
    """Background task: never raises. Records a one-line summary in settings."""
    tpl = await wa.effective_template("reminder") if wa.whatsapp_configured() else ""
    sent = failed = 0
    for g in groups:
        body, variables, lines = reminder_payload(g)
        if wa.whatsapp_configured():
            for to in g["to"]:
                try:
                    ok, info = await wa._send(to, body, tpl, variables)
                except Exception as exc:  # noqa: BLE001
                    ok, info = False, str(exc)
                sent, failed = sent + ok, failed + (not ok)
                (logger.info if ok else logger.error)("Reminder WhatsApp -> %s: %s", to, info)
        if g["email"]:
            try:
                await send_email(to=g["email"], subject=f"{len(g['leads'])} new lead(s) to call today – Digital Shiksha", html=reminder_html(g, lines))
            except Exception as exc:  # noqa: BLE001
                logger.error("Reminder email -> %s failed: %s", g["email"], exc)
    total = sum(len(g["leads"]) for g in groups)
    summary = (f"{datetime.now(timezone.utc).strftime('%d %b %H:%M UTC')} ({trigger}): {total} new lead(s) to {len(groups)} recipient(s)"
               + (f" — WhatsApp sent {sent}, failed {failed}" if wa.whatsapp_configured() else " — WhatsApp not configured"))
    await db.settings.update_one({"key": SETTINGS_KEY}, {"$set": {"last_reminder": summary}}, upsert=True)
