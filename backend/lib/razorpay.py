"""Razorpay payment check for the paid MHT CET predictors (engineering ₹1500, pharmacy ₹599).

Students pay on the static Razorpay Payment Page (PAID_EXAMS link); we then confirm the payment
through the Razorpay REST API (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, basic auth) — by payment ID, or by
finding a recent ₹1500 captured payment made from the student's mobile number.
"""
import os
import time

import httpx

# exam -> (fee in paise, static Razorpay Payment Page)
PAID_EXAMS = {
    "MHT CET": (150000, "https://rzp.io/rzp/6wXdLUk"),            # ₹1500 engineering
    "MHT CET Pharmacy": (59900, "https://rzp.io/rzp/6vvZNmq"),    # ₹599 pharmacy
}
API = "https://api.razorpay.com/v1"


class PaymentError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def configured() -> bool:
    return bool(os.environ.get("RAZORPAY_KEY_ID") and os.environ.get("RAZORPAY_KEY_SECRET"))


def _auth() -> tuple[str, str]:
    return os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]


def _check(p: dict, fee: int) -> dict:
    if p.get("amount") != fee or p.get("currency") != "INR":
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
    """Most recent unused captured payment of this fee from this mobile in the last 24 h."""
    async with httpx.AsyncClient(timeout=20, auth=_auth()) as c:
        r = await c.get(f"{API}/payments", params={"from": int(time.time()) - 86400, "count": 100})
    if r.status_code >= 400:
        raise PaymentError(502, "Couldn't reach Razorpay — please try again")
    mine = [p for p in r.json().get("items", []) if (p.get("contact") or "").replace(" ", "")[-10:] == phone
            and p.get("amount") == fee and p["id"] not in used]
    if not mine:
        raise PaymentError(404, f"No new ₹{fee // 100} payment found from this mobile number. Enter your Razorpay payment ID instead")
    return _check(sorted(mine, key=lambda p: p.get("created_at", 0), reverse=True)[0], fee)
