"""Twilio WhatsApp lead alerts. No-ops until TWILIO_* credentials are set in backend/.env."""
import logging
import os

import httpx

logger = logging.getLogger(__name__)


def whatsapp_configured() -> bool:
    return all(os.environ.get(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "WHATSAPP_ALERT_TO"))


def lead_alert_text(lead: dict) -> str:
    lines = ["*New Digital Shiksha enquiry*", f"Name: {lead['name']}", f"Mobile: +91 {lead['phone']}"]
    for key, label in (("email", "Email"), ("city", "City"), ("course_interest", "Course"), ("college", "College"),
                       ("budget", "Budget"), ("message", "Message"), ("source", "From")):
        if lead.get(key):
            lines.append(f"{label}: {str(lead[key])[:300]}")
    lines.append("Please call back soon.")
    return "\n".join(lines)


async def notify_whatsapp(lead: dict) -> None:
    """Background task: never raises. Sends to every number in WHATSAPP_ALERT_TO (comma-separated, E.164)."""
    if not whatsapp_configured():
        return
    sid, token = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    sender = os.environ["TWILIO_WHATSAPP_FROM"].removeprefix("whatsapp:")
    body = lead_alert_text(lead)
    try:
        async with httpx.AsyncClient(timeout=20, auth=(sid, token)) as client:
            for to in [t.strip() for t in os.environ["WHATSAPP_ALERT_TO"].split(",") if t.strip()]:
                resp = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                    data={"From": f"whatsapp:{sender}", "To": f"whatsapp:{to.removeprefix('whatsapp:')}", "Body": body},
                )
                if resp.status_code >= 400:
                    logger.error("WhatsApp alert to %s failed: %s %s", to, resp.status_code, resp.text[:300])
                else:
                    logger.info("WhatsApp alert for %s sent to %s: %s", lead["id"], to, resp.json().get("sid"))
    except Exception as exc:  # noqa: BLE001
        logger.error("WhatsApp alert failed for %s: %s", lead.get("id"), exc)
