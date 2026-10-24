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


def _assert_safe_email(subject: str, html: str, scan_text: bool = True) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower() if scan_text else ""
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


async def send_email(*, to: str, subject: str, html: str, internal: bool = False) -> str | None:
    """Internal only — recipient/subject/html always come from server-side code (G4)."""
    # internal=True: staff-only alerts that embed escaped applicant text (e.g. a message mentioning "CVV");
    # skip the phishing-phrase scan there, but keep the structural form/link checks.
    _assert_safe_email(subject, html, scan_text=not internal)
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
    if lead.get("role"):
        rows.append(_row("Are you", escape(lead["role"])))
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


async def notify_new_lead(lead: dict, to: str | None = None) -> None:
    """Owner inbox by default (or a counsellor's email). Background task: never raises."""
    to = to or os.environ.get("LEAD_ALERT_EMAIL")
    if not to:
        return
    try:
        subject = f"New enquiry: {lead['name']}" + (f" – {lead['course_interest']}" if lead.get("course_interest") else "")
        email_id = await send_email(to=to, subject=subject[:150], html=lead_alert_html(lead), internal=True)
        logger.info("Lead alert for %s sent: %s", lead["id"], email_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("Lead alert failed for %s: %s", lead.get("id"), exc)


# ---- Student confirmation (fixed server-side template; only a sanitised first name is interpolated)
COUNSELLOR = {
    "phone": "+91 8149 68 9468",
    "tel": "+918149689468",
    "email": "enquiry@digitalshiksha.in",
    "hours": "Monday – Saturday, 10:00 AM – 7:00 PM",
}


def _first_name(name: str) -> str:
    """Letters only, max 20 chars — prevents the form being used to inject text into outbound mail."""
    m = re.match(r"[A-Za-z\u0900-\u097F]+", (name or "").strip())
    first = m.group(0)[:20] if m else ""
    return first or "there"


def student_confirmation_html(lead: dict) -> str:
    c = COUNSELLOR
    first = escape(_first_name(lead.get("name", "")))
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td style="background:#0a2540;padding:22px 24px;border-radius:12px 12px 0 0">'
        '<span style="color:#ffffff;font-size:20px;font-weight:bold"><span style="color:#f87171">Digital</span> Shiksha</span><br>'
        '<span style="color:#cbd5e1;font-size:12px;letter-spacing:1px">COUNSELLING &bull; ADMISSION</span></td></tr>'
        f'<tr><td style="padding:28px 24px 8px"><p style="margin:0 0 12px;font-size:18px;color:#0f172a;font-weight:bold">Hi {first}, thank you for your enquiry!</p>'
        '<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">We have received your request for admission guidance. '
        'One of our expert counsellors will call you within 24 hours to understand your profile and suggest the best-fit colleges and courses.</p>'
        '<p style="margin:0;font-size:15px;line-height:1.6;color:#334155">Keep your entrance exam scorecard and 10th / 12th marksheets handy for the call.</p></td></tr>'
        '<tr><td style="padding:16px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:10px">'
        '<tr><td style="padding:16px 18px;font-size:14px;color:#0f172a;line-height:1.9">'
        '<strong style="font-size:13px;color:#dc2626;letter-spacing:1px">YOUR COUNSELLING DESK</strong><br>'
        f'Call / WhatsApp: <a href="tel:{c["tel"]}" style="color:#1e3a8a;font-weight:bold">{escape(c["phone"])}</a><br>'
        f'Email: <a href="mailto:{c["email"]}" style="color:#1e3a8a">{escape(c["email"])}</a><br>'
        f'Hours: {escape(c["hours"])}</td></tr></table></td></tr>'
        '<tr><td style="padding:8px 24px 24px;font-size:14px;color:#334155;line-height:1.6">Need help sooner? Call us directly — counselling is free.</td></tr>'
        '<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5">'
        'You received this email because you submitted an enquiry to Digital Shiksha. If this wasn\'t you, simply ignore this message. '
        'Digital Shiksha will never ask for passwords, OTPs or payment details by email.</td></tr>'
        '</table></td></tr></table>'
    )


async def send_student_confirmation(lead: dict) -> None:
    """Background task: never raises."""
    to = lead.get("email")
    if not to:
        return
    try:
        email_id = await send_email(to=to, subject="Thank you for contacting Digital Shiksha", html=student_confirmation_html(lead))
        logger.info("Student confirmation for %s sent: %s", lead["id"], email_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("Student confirmation failed for %s: %s", lead.get("id"), exc)


# ---- Paid MHT CET / Pharmacy predictor receipt (fixed server-side template; only escaped server data is interpolated)
def predictor_receipt_html(rec: dict, out, pdf_url: str) -> str:
    c = COUNSELLOR
    first = escape(_first_name(rec.get("name", "")))
    seen, rows = set(), []
    for r in out.results:
        if r.college_slug in seen or len(rows) == 10:
            continue
        seen.add(r.college_slug)
        chance = {"High": ("High chance", "#15803d"), "Medium": ("Good chance", "#b45309")}.get(r.chance, ("Reach", "#dc2626"))
        rows.append(f'<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a"><strong>{escape(r.college_name)}</strong>'
                    f'<br><span style="color:#64748b">{escape(r.course)} &middot; {escape(r.city)}</span></td>'
                    f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:bold;color:{chance[1]};white-space:nowrap">{chance[0]}</td></tr>')
    empty = '<tr><td style="padding:10px;font-size:13px">No direct matches &ndash; our counsellor will suggest options.</td></tr>'
    paid = rec["created_at"].strftime("%d %b %Y, %I:%M %p UTC")
    btn = (f'<tr><td style="padding:4px 24px 8px"><a href="{escape(pdf_url)}" style="display:inline-block;background:#dc2626;color:#ffffff;'
           'text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px">Download full college list (PDF)</a></td></tr>') if pdf_url else ""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td style="background:#0a2540;padding:22px 24px;border-radius:12px 12px 0 0">'
        '<span style="color:#ffffff;font-size:20px;font-weight:bold"><span style="color:#4ade80">Digital</span> Shiksha</span><br>'
        '<span style="color:#cbd5e1;font-size:12px;letter-spacing:1px">PAYMENT RECEIPT &bull; COLLEGE PREDICTOR</span></td></tr>'
        f'<tr><td style="padding:24px 24px 8px"><p style="margin:0 0 10px;font-size:18px;color:#0f172a;font-weight:bold">Hi {first}, thank you for your payment!</p>'
        f'<p style="margin:0;font-size:15px;line-height:1.6;color:#334155">Here is your {escape(out.exam)} college prediction for <strong>{rec["score"]:g} percentile</strong> '
        f'({escape(out.category)}). The full list with all CAP round cut-offs is in the PDF below.</p></td></tr>'
        '<tr><td style="padding:12px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px">'
        '<tr><td style="padding:14px 16px;font-size:14px;color:#0f172a;line-height:1.8">'
        f'Amount paid: <strong>&#8377;{int(rec["amount"]):,}</strong><br>Payment ID: <strong>{escape(rec["payment_id"])}</strong><br>'
        f'Date: {escape(paid)}<br>For: {escape(out.exam)} College Predictor &ndash; {rec["score"]:g} percentile</td></tr></table></td></tr>'
        + btn +
        '<tr><td style="padding:12px 24px"><p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#dc2626;letter-spacing:1px">YOUR TOP COLLEGES</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px">{"".join(rows) or empty}</table></td></tr>'
        f'<tr><td style="padding:12px 24px 20px;font-size:14px;color:#334155;line-height:1.6">Need help with your option form? Call / WhatsApp '
        f'<a href="tel:{c["tel"]}" style="color:#1e3a8a;font-weight:bold">{escape(c["phone"])}</a> &ndash; counselling is free.</td></tr>'
        '<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5">'
        'You received this receipt because you paid for the Digital Shiksha College Predictor. Keep it for your records. '
        'Digital Shiksha will never ask for passwords or OTPs by email.</td></tr>'
        '</table></td></tr></table>'
    )


async def send_predictor_receipt(rec: dict, out, pdf_url: str) -> bool:
    """Background-safe: returns False instead of raising."""
    try:
        email_id = await send_email(to=rec["email"], subject=f"Your Digital Shiksha receipt & {out.exam} college list ({rec['score']:g} percentile)",
                                    html=predictor_receipt_html(rec, out, pdf_url))
        logger.info("Predictor receipt %s sent: %s", rec["payment_id"], email_id)
        return bool(email_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("Predictor receipt %s failed: %s", rec.get("payment_id"), exc)
        return False


# ---- Owner alert for each paid prediction (internal; fixed template, escaped server data only)
def payment_alert_html(rec: dict, out, pdf_url: str) -> str:
    phone, pid = escape(rec["phone"]), escape(rec["payment_id"])
    exam = escape({"MHT CET": "MHT CET (Engineering)", "MHT CET Pharmacy": "MHT CET (Pharmacy)"}.get(out.exam, out.exam))
    rows = [_row("Name", escape(rec.get("name") or "—")), _row("Are you", escape(rec.get("role") or "—")), _row("Mobile", f'<a href="tel:+91{phone}" style="color:#1e3a8a">+91 {phone}</a>'),
            _row("Exam", exam), _row("Percentile", f'{rec["score"]:g} ({escape(out.category)})'),
            _row("Amount", f'&#8377;{int(rec["amount"]):,}'),
            _row("Payment ID", f'<a href="https://dashboard.razorpay.com/app/payments/{pid}" style="color:#1e3a8a">{pid}</a>'),
            _row("Status", "Verified with Razorpay" if rec.get("verified") else '<strong style="color:#b45309">Not auto-verified &ndash; check this ID in Razorpay</strong>'),
            _row("Student email", escape(rec.get("email") or "—")),
            _row("Paid at", escape(rec["created_at"].strftime("%d %b %Y, %I:%M %p UTC")))]
    btn = (f'<p style="margin:20px 0 0"><a href="{escape(pdf_url)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;'
           'font-weight:bold;font-size:14px;padding:11px 20px;border-radius:8px">Download prediction PDF</a></p>') if pdf_url else ""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td style="background:#0a2540;padding:20px 24px;border-radius:12px 12px 0 0">'
        '<span style="color:#ffffff;font-size:18px;font-weight:bold"><span style="color:#4ade80">Digital</span> Shiksha</span>'
        '<span style="color:#cbd5e1;font-size:13px;margin-left:8px">New predictor payment</span></td></tr>'
        f'<tr><td style="padding:24px"><p style="margin:0 0 16px;font-size:16px;color:#0f172a"><strong>{escape(rec.get("name") or "A student")}</strong> '
        f'paid for the {exam} college prediction ({len({r.college_name for r in out.results})} colleges, {out.total} course options).</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px">{"".join(rows)}</table>'
        + btn +
        '<p style="margin:20px 0 0;font-size:13px;color:#64748b">All payments are listed in the admin panel (Predictor tab &rarr; Predictor payments).</p>'
        '</td></tr><tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">'
        'Automated payment alert sent by Digital Shiksha.</td></tr></table></td></tr></table>'
    )


async def notify_payment(rec: dict, out, pdf_url: str) -> None:
    """Owner inbox (LEAD_ALERT_EMAIL). Background task: never raises."""
    to = os.environ.get("LEAD_ALERT_EMAIL")
    if not to:
        return
    try:
        subject = f"Payment ₹{int(rec['amount']):,}: {rec.get('name') or 'Student'} – {out.exam} {rec['score']:g} percentile"
        email_id = await send_email(to=to, subject=subject[:150], html=payment_alert_html(rec, out, pdf_url), internal=True)
        logger.info("Payment alert %s sent: %s", rec["payment_id"], email_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("Payment alert %s failed: %s", rec.get("payment_id"), exc)


# ---- Admin password reset (fixed template to the owner inbox; link is first-party https, 30-min single-use)
def admin_reset_html(username: str, link: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td style="background:#0a2540;padding:20px 24px;border-radius:12px 12px 0 0">'
        '<span style="color:#ffffff;font-size:18px;font-weight:bold"><span style="color:#4ade80">Digital</span> Shiksha</span>'
        '<span style="color:#cbd5e1;font-size:13px;margin-left:8px">Admin password reset</span></td></tr>'
        '<tr><td style="padding:24px;font-size:15px;line-height:1.6;color:#334155">'
        '<p style="margin:0 0 12px">Someone asked to reset the Digital Shiksha admin password. If that was you, choose a new password below.</p>'
        f'<p style="margin:0 0 16px">Admin username: <strong style="color:#0f172a">{escape(username)}</strong></p>'
        f'<p style="margin:0 0 16px"><a href="{escape(link)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;'
        'font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px">Set a new admin password</a></p>'
        '<p style="margin:0;font-size:13px;color:#64748b">The link works once and expires in 30 minutes. '
        'If you did not ask for this, ignore this email &ndash; your current password keeps working.</p></td></tr>'
        '<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">Automated security email sent by Digital Shiksha.</td></tr>'
        '</table></td></tr></table>'
    )


async def send_admin_reset(to: str, username: str, link: str) -> bool:
    try:
        email_id = await send_email(to=to, subject="Reset your Digital Shiksha admin password", html=admin_reset_html(username, link), internal=True)
        logger.info("Admin reset email sent: %s", email_id)
        return bool(email_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("Admin reset email failed: %s", exc)
        return False
