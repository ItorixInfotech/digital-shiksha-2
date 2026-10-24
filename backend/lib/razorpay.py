"""Razorpay payment check for the paid MHT CET predictors (engineering ₹1500, pharmacy ₹599).

Students pay on the static Razorpay Payment Page (PAID_EXAMS link); we then confirm the payment
through the Razorpay REST API (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, basic auth) — by payment ID, or by
finding a recent ₹1500 captured payment made from the student's mobile number.
"""
import logging
import os
import time

import httpx

# exam -> (fee in paise, static Razorpay Payment Page)
PAID_EXAMS = {
    "MHT CET": (150000, "https://rzp.io/rzp/6wXdLUk"),            # ₹1500 engineering
    "MHT CET Pharmacy": (59900, "https://rzp.io/rzp/6vvZNmq"),    # ₹599 pharmacy
}
API = "https://api.razorpay.com/v1"
logger = logging.getLogger(__name__)


class PaymentError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def configured() -> bool:
    return bool(os.environ.get("RAZORPAY_KEY_ID") and os.environ.get("RAZORPAY_KEY_SECRET"))


def _auth() -> tuple[str, str]:
    return os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]


def _amount_ok(amount, fee: int) -> bool:
    """Exact fee, or fee + a customer-paid convenience fee (Razorpay adds it to the amount; allow up to 5 %)."""
    return isinstance(amount, int) and fee <= amount <= fee * 105 // 100


def _digits10(v) -> str:
    d = "".join(ch for ch in str(v or "") if ch.isdigit())
    return d[-10:] if len(d) >= 10 else ""


def _phones(p: dict) -> set[str]:
    """Mobile on the payment: checkout contact plus any phone typed into the payment-page form (stored in notes)."""
    notes = p.get("notes") if isinstance(p.get("notes"), dict) else {}
    return {x for x in [_digits10(p.get("contact"))] + [_digits10(v) for v in notes.values()] if x}


def _check(p: dict, fee: int) -> dict:
    if not _amount_ok(p.get("amount"), fee) or p.get("currency") != "INR":
        raise PaymentError(402, f"This payment is not the ₹{fee // 100} fee for this predictor")
    if p.get("status") == "authorized":
        raise PaymentError(409, "Your payment is still processing — please try again in a minute")
    if p.get("status") != "captured":
        raise PaymentError(402, "This payment was not completed")
    return p


async def fetch_payment(payment_id: str, fee: int) -> dict:
    async with httpx.AsyncClient(timeout=20, auth=_auth()) as c:
        r = await c.get(f"{API}/payments/{payment_id}")
    if r.status_code in (400, 404):
        raise PaymentError(404, "We couldn't find this payment ID — please check it")
    if r.status_code >= 400:
        raise PaymentError(502, "Couldn't reach Razorpay — please try again")
    return _check(r.json(), fee)


async def find_by_phone(phone: str, used: set[str], fee: int) -> dict:
    """Most recent unused payment of this fee from this mobile in the last 48 h (up to 300 payments scanned)."""
    items: list[dict] = []
    async with httpx.AsyncClient(timeout=20, auth=_auth()) as c:
        for page in range(3):
            r = await c.get(f"{API}/payments", params={"from": int(time.time()) - 2 * 86400, "count": 100, "skip": page * 100})
            if r.status_code >= 400:
                logger.error("Razorpay list payments failed: %s %s", r.status_code, r.text[:200])
                raise PaymentError(502, "Couldn't reach Razorpay — please try again")
            batch = r.json().get("items", [])
            items += batch
            if len(batch) < 100:
                break
    by_phone = [p for p in items if phone in _phones(p)]
    mine = [p for p in by_phone if _amount_ok(p.get("amount"), fee) and p.get("id") not in used]
    # Diagnostics without personal data: why nothing matched.
    logger.info("Razorpay find_by_phone: scanned=%d phone_match=%d fee_match_unused=%d phone_amounts=%s statuses=%s fee=%d",
                len(items), len(by_phone), len(mine), [p.get("amount") for p in by_phone][:5], [p.get("status") for p in by_phone][:5], fee)
    if not mine:
        if by_phone and all(p.get("id") in used for p in by_phone if _amount_ok(p.get("amount"), fee)) and any(_amount_ok(p.get("amount"), fee) for p in by_phone):
            raise PaymentError(409, "Your payment from this mobile was already used for a prediction. Changing your percentile needs a new payment")
        raise PaymentError(404, f"No new ₹{fee // 100} payment found from this mobile number yet. If you just paid, wait a minute and try again, or check the mobile number you paid with")
    captured = [p for p in mine if p.get("status") == "captured"] or mine
    return _check(sorted(captured, key=lambda p: p.get("created_at", 0), reverse=True)[0], fee)
