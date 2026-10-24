"""Step 2 with a typed mobile matches a real-shaped ₹1499 payment and creates the PDF.

httpx.ASGITransport against server.app (in-process — required since we mock the outbound
Razorpay HTTP call made inside this same process), mocking ONLY the Razorpay "list payments"
call (GET api.razorpay.com/v1/payments) to return a single captured ₹1499 payment shaped like
a real Razorpay Payment Page checkout (contact + email set, notes empty).
"""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import os
os.environ["WHATSAPP_ALERT_TO"] = ""
os.environ["LEAD_ALERT_EMAIL"] = "delivered@resend.dev"

import server  # noqa: E402
from lib.db import db  # noqa: E402

EXAM = "MHT CET"
PHONE = "9876543210"
PAYMENT_ID = "pay_TESTAGENT1499"


_REAL_GET = httpx.AsyncClient.get  # only api.razorpay.com calls get mocked; everything else (our own ASGI
                                    # test client, the pdf_url fetch) must reach the real implementation


async def _patched_get(self, url, *args, params=None, **kwargs):
    if "api.razorpay.com" in str(url):
        if params and params.get("skip", 0) > 0:
            return httpx.Response(200, json={"items": []}, request=httpx.Request("GET", str(url)))
        payment = {
            "id": PAYMENT_ID, "amount": 149900, "currency": "INR", "status": "captured",
            "contact": "+919876543210", "email": "delivered@resend.dev", "notes": {}, "created_at": 1700000000,
        }
        return httpx.Response(200, json={"items": [payment]}, request=httpx.Request("GET", str(url)))
    return await _REAL_GET(self, url, *args, params=params, **kwargs)


@pytest.mark.asyncio
async def test_unlock_matches_real_shaped_1499_payment_and_creates_pdf():
    transport = httpx.ASGITransport(app=server.app)
    created_doc = False
    try:
        with patch("httpx.AsyncClient.get", new=_patched_get):
            async with httpx.AsyncClient(transport=transport, base_url="http://test/api") as c:
                body = {
                    "prediction": {"exam": EXAM, "score": 93.5, "category": "General", "cities": []},
                    "name": "Test Agent", "phone": PHONE, "payment_id": "",
                }
                r = await c.post("/predictor/unlock", json=body)
                assert r.status_code == 200, r.text
                created_doc = True
                out = r.json()
                assert out["amount"] == 1499, out
                assert out["pdf_url"]

                set_cookie = r.headers.get("set-cookie", "")
                assert set_cookie.startswith("ds_unlocks="), set_cookie
                token = set_cookie.split(";", 1)[0].split("=", 1)[1]
                cookie_hdr = {"Cookie": f"ds_unlocks={token}"}

                pdf = await c.get("http://test" + out["pdf_url"], headers=cookie_hdr)
                assert pdf.status_code == 200
                assert pdf.headers["content-type"] == "application/pdf"
                assert pdf.content[:4] == b"%PDF"

                # A stale 150000-only expectation must no longer reject this 149900 payment.
                predict = await c.post("/predictor", json={
                    "exam": EXAM, "score": 93.5, "category": "General", "cities": [],
                }, headers=cookie_hdr)
                assert predict.status_code == 200, predict.text
    finally:
        if created_doc:
            await db.predictor_unlocks.delete_many({"payment_id": PAYMENT_ID})
