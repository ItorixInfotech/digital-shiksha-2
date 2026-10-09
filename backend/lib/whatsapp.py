"""Twilio WhatsApp: counsellor lead alerts + student predicted-college list.

WhatsApp only allows business-initiated messages through approved Content templates (ContentSid).
- TWILIO_LEAD_TEMPLATE_SID    variables: {{1}} name, {{2}} mobile, {{3}} interest, {{4}} details
- TWILIO_STUDENT_TEMPLATE_SID variables: {{1}} first name, {{2}} exam & score, {{3}} top colleges, {{4}} results link
Without a template SID we fall back to a free-form Body (works only inside a 24h session / paid sender).
"""
import json
import logging
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from lib.db import db

logger = logging.getLogger(__name__)
_KEYS = ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "WHATSAPP_ALERT_TO")


def whatsapp_configured() -> bool:
    return all(os.environ.get(k) for k in _KEYS)


def _var(v: str, limit: int = 300) -> str:
    """Template variables may not contain newlines/tabs or 4+ consecutive spaces."""
    return re.sub(r"\s{2,}", " ", re.sub(r"[\r\n\t]+", " | ", str(v or "-"))).strip()[:limit] or "-"


async def _record(kind: str, ok: bool, detail: str) -> None:
    await db.settings.update_one(
        {"key": f"whatsapp_{kind}"},
        {"$set": {"key": f"whatsapp_{kind}", "ok": ok, "detail": detail[:300], "at": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def _send(to: str, body: str, template_sid: str, variables: dict) -> tuple[bool, str]:
    sid, token = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    sender = os.environ["TWILIO_WHATSAPP_FROM"].removeprefix("whatsapp:")
    data = {"From": f"whatsapp:{sender}", "To": f"whatsapp:{to.removeprefix('whatsapp:')}"}
    if template_sid:
        data["ContentSid"] = template_sid
        data["ContentVariables"] = json.dumps({k: _var(v) for k, v in variables.items()})
    else:
        data["Body"] = body[:1500]
    async with httpx.AsyncClient(timeout=20, auth=(sid, token)) as client:
        resp = await client.post(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=data)
    if resp.status_code >= 400:
        try:
            msg = resp.json().get("message", resp.text)
        except ValueError:
            msg = resp.text
        if not template_sid and "ContentSid" in msg:
            msg = "WhatsApp requires an approved message template (ContentSid) for this sender — add the approved template SID in Admin → WhatsApp"
        return False, f"{resp.status_code}: {msg}"
    return True, resp.json().get("sid", "")


def lead_alert_text(lead: dict) -> str:
    lines = ["*New Digital Shiksha enquiry*", f"Name: {lead['name']}", f"Mobile: +91 {lead['phone']}"]
    for key, label in (("email", "Email"), ("city", "City"), ("course_interest", "Course"), ("college", "College"),
                       ("budget", "Budget"), ("message", "Message"), ("source", "From")):
        if lead.get(key):
            lines.append(f"{label}: {str(lead[key])[:300]}")
    lines.append("Please call back soon.")
    return "\n".join(lines)


def lead_payload(lead: dict) -> tuple[str, dict]:
    interest = " / ".join(x for x in (lead.get("course_interest"), lead.get("college")) if x) or "Not specified"
    details = " | ".join(x for x in (lead.get("city"), lead.get("message"), f"via {lead.get('source')}") if x)
    return lead_alert_text(lead), {"1": lead["name"], "2": f"+91 {lead['phone']}", "3": interest, "4": details}


def alert_numbers() -> list[str]:
    return [t.strip() for t in os.environ.get("WHATSAPP_ALERT_TO", "").split(",") if t.strip()]


async def notify_whatsapp(lead: dict) -> None:
    """Counsellor alert. Background task: never raises."""
    if not whatsapp_configured():
        return
    body, variables = lead_payload(lead)
    try:
        tpl = await effective_template("lead")
        for to in alert_numbers():
            ok, info = await _send(to, body, tpl, variables)
            await _record("lead", ok, info)
            (logger.info if ok else logger.error)("WhatsApp lead alert %s -> %s: %s", lead["id"], to, info)
    except Exception as exc:  # noqa: BLE001
        await _record("lead", False, str(exc))
        logger.error("WhatsApp alert failed for %s: %s", lead.get("id"), exc)


def _score_label(out) -> str:
    if out.metric == "rank":
        return f"{out.exam} rank {int(out.score)} ({out.category})"
    if out.metric == "score":
        return f"{out.exam} {int(out.score)}/720 ({out.category})"
    return f"{out.exam} {out.score:g} percentile ({out.category})"


def results_link(pred: dict) -> str:
    base = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
    cities = pred.get("cities") or []
    city = "both" if sorted(cities) == ["Mumbai", "Pune"] else (cities[0] if len(cities) == 1 else "all")
    qs = urlencode({"exam": pred["exam"], "score": f"{pred['score']:g}", "category": pred.get("category", "General"), "city": city})
    return f"{base}/predictor?{qs}" if base else ""


def student_payload(lead: dict, out, pred: dict) -> tuple[str, dict]:
    first = (re.match(r"[A-Za-z\u0900-\u097F]+", lead.get("name", "").strip()) or [None])[0] or "there"
    seen, top = set(), []
    for r in out.results:
        if r.college_slug in seen:
            continue
        seen.add(r.college_slug)
        top.append(f"{len(top) + 1}) {r.short_name} - {r.course} ({'High' if r.chance == 'High' else 'Good' if r.chance == 'Medium' else 'Reach'})")
        if len(top) == 5:
            break
    top_text = "; ".join(top) if top else "No direct matches - our counsellor will suggest options"
    link = results_link(pred)
    body = (f"Hi {first}, here is your Digital Shiksha college prediction for {_score_label(out)}:\n"
            + "\n".join(top or [top_text])
            + (f"\n\nFull list & PDF: {link}" if link else "")
            + "\n\nFree counselling: +91 8149 68 9468")
    return body, {"1": first, "2": _score_label(out), "3": top_text, "4": link or "-"}


async def send_student_prediction(lead: dict, out, pred: dict) -> None:
    """Student's own predicted college list (only when they ticked the WhatsApp opt-in). Never raises."""
    if not whatsapp_configured():
        return
    body, variables = student_payload(lead, out, pred)
    try:
        ok, info = await _send(f"+91{lead['phone']}", body, await effective_template("student"), variables)
        await _record("student", ok, info)
        (logger.info if ok else logger.error)("WhatsApp student list %s: %s", lead["id"], info)
    except Exception as exc:  # noqa: BLE001
        await _record("student", False, str(exc))
        logger.error("WhatsApp student list failed for %s: %s", lead.get("id"), exc)


async def whatsapp_status() -> dict:
    rows = {d["key"]: d for d in await db.settings.find({"key": {"$in": ["whatsapp_lead", "whatsapp_student"]}}, {"_id": 0}).to_list(5)}

    def last(k: str) -> str:
        d = rows.get(k)
        if not d:
            return "not sent yet"
        at = d["at"].replace(tzinfo=timezone.utc) if d["at"].tzinfo is None else d["at"]
        return f"{'delivered to Twilio' if d['ok'] else 'FAILED'} {at.strftime('%d %b %H:%M UTC')}" + ("" if d["ok"] else f" — {d['detail']}")

    return {
        "configured": whatsapp_configured(),
        "lead_template": bool(await effective_template("lead")),
        "student_template": bool(await effective_template("student")),
        "last_lead": last("whatsapp_lead"),
        "last_student": last("whatsapp_student"),
    }


# ---------------- Templates: SIDs (admin-editable, env fallback) + WhatsApp approval status
TEMPLATE_ENV = {"lead": "TWILIO_LEAD_TEMPLATE_SID", "student": "TWILIO_STUDENT_TEMPLATE_SID"}
RECHECK_SECONDS = 600


async def template_sids() -> dict:
    doc = await db.settings.find_one({"key": "whatsapp_templates"}, {"_id": 0}) or {}
    return {k: (doc.get(k) if doc.get(k) is not None else os.environ.get(env, "")) or "" for k, env in TEMPLATE_ENV.items()}


async def save_template_sids(lead_sid: str, student_sid: str) -> None:
    await db.settings.update_one({"key": "whatsapp_templates"},
                                 {"$set": {"key": "whatsapp_templates", "lead": lead_sid, "student": student_sid}}, upsert=True)


async def check_template(sid: str) -> dict:
    """Ask Twilio Content API for the template text + WhatsApp approval status; cache the answer."""
    info = {"sid": sid, "status": "unknown", "name": "", "body": "", "variables": 0, "rejection_reason": "", "note": ""}
    auth = (os.environ.get("TWILIO_ACCOUNT_SID", ""), os.environ.get("TWILIO_AUTH_TOKEN", ""))
    try:
        async with httpx.AsyncClient(timeout=15, auth=auth) as client:
            content = await client.get(f"https://content.twilio.com/v1/Content/{sid}")
            approval = await client.get(f"https://content.twilio.com/v1/Content/{sid}/ApprovalRequests")
        if content.status_code == 401 and "Trial" in content.text:
            info.update(status="unavailable", note="Twilio trial accounts can't use the Content API. Upgrade Twilio to create and check templates.")
        elif content.status_code == 404:
            info.update(status="not_found", note="No template with this SID in your Twilio account.")
        elif content.status_code >= 400:
            info.update(note=f"Twilio error {content.status_code}: {content.json().get('message', '')[:200]}")
        else:
            c = content.json()
            types = c.get("types") or {}
            first = next(iter(types.values()), {}) if types else {}
            info.update(name=c.get("friendly_name", ""), body=(first.get("body") or "")[:1000], variables=len(c.get("variables") or {}))
            wa = (approval.json().get("whatsapp") or {}) if approval.status_code < 400 else {}
            info.update(status=(wa.get("status") or "not_submitted").lower(), rejection_reason=wa.get("rejection_reason") or "")
    except Exception as exc:  # noqa: BLE001
        info["note"] = f"Could not reach Twilio: {exc}"[:200]
    info["checked_at"] = datetime.now(timezone.utc)
    await db.settings.update_one({"key": f"tpl_{sid}"}, {"$set": {"key": f"tpl_{sid}", **info}}, upsert=True)
    return info


async def template_info(sid: str, refresh: bool = False) -> dict | None:
    if not sid:
        return None
    doc = await db.settings.find_one({"key": f"tpl_{sid}"}, {"_id": 0, "key": 0})
    if refresh or not doc:
        return await check_template(sid)
    return doc


async def effective_template(kind: str) -> str:
    """Use the template only once WhatsApp has approved it; re-check pending ones every 10 minutes."""
    sid = (await template_sids()).get(kind, "")
    if not sid:
        return ""
    info = await template_info(sid)
    if info and info.get("status") != "approved":
        at = info.get("checked_at")
        at = at.replace(tzinfo=timezone.utc) if at and at.tzinfo is None else at
        if not at or (datetime.now(timezone.utc) - at).total_seconds() > RECHECK_SECONDS:
            info = await check_template(sid)
    status = (info or {}).get("status")
    # "unavailable" (trial / API blocked) → we can't verify, so try the SID anyway and let Twilio decide.
    return sid if status in ("approved", "unavailable", "unknown") else ""


async def message_status(message_sid: str) -> dict:
    sid, token = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    async with httpx.AsyncClient(timeout=15, auth=(sid, token)) as client:
        r = await client.get(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages/{message_sid}.json")
    if r.status_code >= 400:
        return {"status": "unknown", "error": f"{r.status_code}"}
    d = r.json()
    return {"status": d.get("status", "unknown"), "error": (f"{d.get('error_code')}: {d.get('error_message') or ''}" if d.get("error_code") else "")}
