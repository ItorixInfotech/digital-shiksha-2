"""Emergent-managed Resend email (see integration playbook). Lead alerts to the owner inbox only."""
import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# Emergent managed email proxy — a constant on purpose (must survive deployment).
EMAIL_BASE_URL = "https://integrations.emergentagent.com"

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    """Internal only — recipient/subject/html always come from server-side code (G4)."""
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": os.environ["EMAIL_FROM_NAME"]}
    reply_to = os.environ.get("EMAIL_REPLY_TO")
    if reply_to:
        payload["contact_email"] = reply_to
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{EMAIL_BASE_URL}/api/v1/email/send",
            headers={"X-Email-Key": os.environ["EMERGENT_EMAIL_KEY"]},
            json=payload,
        )
    if resp.status_code >= 400:
        try:
            body = resp.json()
        except ValueError:
            body = {}
        code = body.get("code", "")
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning("Email paused: %s (%s): %s", code, resp.status_code, body.get("message", ""))
        else:
            logger.error("Email send failed: %s %s", resp.status_code, resp.text)
        return None
    return resp.json().get("id")


def _row(label: str, value: str) -> str:
    return (f'<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;width:150px;border-bottom:1px solid #e2e8f0">{escape(label)}</td>'
            f'<td style="padding:8px 12px;color:#0f172a;font-size:14px;border-bottom:1px solid #e2e8f0">{value}</td></tr>')


def lead_alert_html(lead: dict) -> str:
    phone = escape(lead["phone"])
    rows = [_row("Name", escape(lead["name"])), _row("Mobile", f'<a href="tel:+91{phone}" style="color:#1e3a8a">+91 {phone}</a>')]
    if lead.get("email"):
        em = escape(lead["email"])
        rows.append(_row("Email", f'<a href="mailto:{em}" style="color:#1e3a8a">{em}</a>'))
    for key, label in (("city", "City"), ("course_interest", "Course interest"), ("college", "College"),
                       ("budget", "Budget"), ("message", "Message"), ("source", "Submitted from")):
        if lead.get(key):
            rows.append(_row(label, escape(str(lead[key]))))
    created = lead["created_at"].strftime("%d %b %Y, %I:%M %p UTC")
    rows.append(_row("Received", escape(created)))
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td style="background:#0a2540;padding:20px 24px;border-radius:12px 12px 0 0">'
        '<span style="color:#ffffff;font-size:18px;font-weight:bold"><span style="color:#f87171">Digital</span> Shiksha</span>'
        '<span style="color:#cbd5e1;font-size:13px;margin-left:8px">New enquiry</span></td></tr>'
        f'<tr><td style="padding:24px"><p style="margin:0 0 16px;font-size:16px;color:#0f172a">'
        f'<strong>{escape(lead["name"])}</strong> just submitted an enquiry on the website. Call back soon.</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px">{"".join(rows)}</table>'
        '<p style="margin:20px 0 0;font-size:13px;color:#64748b">Update the lead status in the Digital Shiksha admin panel (Leads tab).</p>'
        '</td></tr><tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">'
        'Automated lead alert sent by Digital Shiksha. We never ask for passwords or payment details by email.</td></tr>'
        '</table></td></tr></table>'
    )


async def notify_new_lead(lead: dict) -> None:
    """Background task: never raises, so a mail outage never breaks lead capture."""
    to = os.environ.get("LEAD_ALERT_EMAIL")
    if not to:
        return
    try:
        subject = f"New enquiry: {lead['name']}" + (f" – {lead['course_interest']}" if lead.get("course_interest") else "")
        email_id = await send_email(to=to, subject=subject[:150], html=lead_alert_html(lead))
        logger.info("Lead alert for %s sent: %s", lead["id"], email_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("Lead alert failed for %s: %s", lead.get("id"), exc)
