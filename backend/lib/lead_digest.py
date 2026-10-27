"""Evening lead digest: one email to the owner (LEAD_ALERT_EMAIL) listing every enquiry of the last 24 hours,
a safety net for any instant alert that failed. Triggered by the platform cron (8 PM IST) or manually from admin."""
import logging
import os
from datetime import datetime, timedelta, timezone
from html import escape
from zoneinfo import ZoneInfo

from lib.db import db
from lib.email import send_email

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")
TD = 'style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;vertical-align:top"'
TH = 'style="padding:8px 10px;background:#f1f5f9;font-size:12px;color:#475569;text-align:left"'


async def build_digest(hours: int = 24) -> tuple[list[dict], datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)
    leads = await db.leads.find({"created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    names = {c["id"]: c.get("name", "") for c in await db.counsellors.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)}
    for lead in leads:
        lead["counsellor"] = names.get(lead.get("counsellor_id") or "", "") or "Unassigned"
    return leads, start, end


def digest_html(leads: list[dict], start: datetime, end: datetime) -> str:
    fmt = lambda d: d.replace(tzinfo=d.tzinfo or timezone.utc).astimezone(IST).strftime("%d %b, %I:%M %p")
    by_src: dict[str, int] = {}
    for lead in leads:
        by_src[lead.get("source") or "website"] = by_src.get(lead.get("source") or "website", 0) + 1
    rows = "".join(
        "<tr>"
        f'<td {TD}>{escape(fmt(lead["created_at"]))}</td>'
        f'<td {TD}><strong>{escape(lead["name"])}</strong>{"<br>" + escape(lead["email"]) if lead.get("email") else ""}</td>'
        f'<td {TD}><a href="tel:+91{escape(lead["phone"])}" style="color:#0a2540">{escape(lead["phone"])}</a></td>'
        f'<td {TD}>{escape(" · ".join(x for x in (lead.get("city"), lead.get("course_interest"), lead.get("college")) if x) or "—")}'
        f'{"<br><span style=color:#64748b>" + escape(lead["message"][:160]) + "</span>" if lead.get("message") else ""}</td>'
        f'<td {TD}>{escape(lead.get("source") or "website")}</td>'
        f'<td {TD}>{escape(lead.get("status", "New"))}<br><span style="color:#64748b">{escape(lead["counsellor"])}</span></td>'
        "</tr>"
        for lead in leads
    )
    summary = " &bull; ".join(f"{escape(k)}: {v}" for k, v in sorted(by_src.items(), key=lambda x: -x[1]))
    body = (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px">'
        f'<tr><th {TH}>Time (IST)</th><th {TH}>Name</th><th {TH}>Mobile</th><th {TH}>Interest / message</th><th {TH}>Source</th><th {TH}>Status / counsellor</th></tr>'
        f"{rows}</table>"
        if leads else '<p style="margin:0;font-size:15px;color:#334155">No new enquiries in the last 24 hours. The website forms are being monitored.</p>'
    )
    new_count = sum(1 for lead in leads if lead.get("status", "New") == "New")
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="760" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td style="background:#0a2540;padding:20px 24px;border-radius:12px 12px 0 0">'
        '<span style="color:#ffffff;font-size:18px;font-weight:bold"><span style="color:#f87171">Digital</span> Shiksha</span>'
        '<span style="color:#cbd5e1;font-size:13px;margin-left:8px">Evening lead digest</span></td></tr>'
        f'<tr><td style="padding:24px"><p style="margin:0 0 6px;font-size:22px;font-weight:bold;color:#0f172a">{len(leads)} new enquir{"y" if len(leads) == 1 else "ies"}</p>'
        f'<p style="margin:0 0 16px;font-size:13px;color:#64748b">{escape(fmt(start))} – {escape(fmt(end))} IST'
        f'{" &bull; " + str(new_count) + " still New (not yet contacted)" if leads else ""}</p>'
        f'{"<p style=" + chr(34) + "margin:0 0 16px;font-size:13px;color:#334155" + chr(34) + ">By source: " + summary + "</p>" if leads else ""}'
        f"{body}"
        '<p style="margin:20px 0 0;font-size:13px;color:#64748b">Every enquiry is also saved in the admin panel (Leads tab), even if an instant alert email failed.</p>'
        '</td></tr><tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">'
        'Automated daily digest sent by Digital Shiksha at 8 PM IST. We never ask for passwords or payment details by email.</td></tr>'
        '</table></td></tr></table>'
    )


async def send_lead_digest(trigger: str = "8 PM schedule") -> dict:
    """Never raises (runs in background tasks)."""
    to = os.environ.get("LEAD_ALERT_EMAIL")
    if not to:
        logger.warning("Lead digest skipped: LEAD_ALERT_EMAIL not set")
        return {"sent": False, "count": 0}
    try:
        leads, start, end = await build_digest()
        day = end.astimezone(IST).strftime("%d %b %Y")
        subject = f"Daily lead digest – {len(leads)} enquir{'y' if len(leads) == 1 else 'ies'} ({day})"
        email_id = await send_email(to=to, subject=subject, html=digest_html(leads, start, end), internal=True)
        await db.settings.update_one({"key": "lead_digest_last"}, {"$set": {"key": "lead_digest_last", "at": end, "count": len(leads),
                                                                         "trigger": trigger, "ok": bool(email_id)}}, upsert=True)
        logger.info("Lead digest (%s): %d leads, email %s", trigger, len(leads), email_id)
        return {"sent": bool(email_id), "count": len(leads)}
    except Exception as exc:  # noqa: BLE001
        logger.error("Lead digest failed: %s", exc)
        return {"sent": False, "count": 0}
