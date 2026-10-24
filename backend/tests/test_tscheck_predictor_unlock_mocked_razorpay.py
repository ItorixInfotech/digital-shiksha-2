"""POST /api/predictor/unlock end-to-end with Razorpay mocked (no real Razorpay calls).

Uses httpx.ASGITransport against server.app directly (per the matrix criterion) with
lib.razorpay.find_by_phone monkeypatched to return a captured payment. This is an in-process
exception to the "test over HTTP against the running server" convention, required because the
monkeypatch of the Razorpay lookup only works for code running in this same process.
"""
import sys
from pathlib import Path
from unittest.mock import patch, AsyncMock

import pytest
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import os
os.environ.setdefault("WHATSAPP_ALERT_TO", "")
os.environ["WHATSAPP_ALERT_TO"] = ""
os.environ["LEAD_ALERT_EMAIL"] = "delivered@resend.dev"

import server  # noqa: E402
from lib.db import db  # noqa: E402

EXAM = "MHT CET Pharmacy"
FEE_RUPEES = 599
PHONE = "9876543210"
PAYMENT_ID = "pay_TESTAGENT0002"


def _mock_payment():
    return {"id": PAYMENT_ID, "amount": FEE_RUPEES * 100, "status": "captured", "currency": "INR",
            "contact": "+919876543210", "email": "delivered@resend.dev", "created_at": 1234567890}


@pytest.mark.asyncio
async def test_unlock_mocked_razorpay_end_to_end_then_access_and_pdf():
    transport = httpx.ASGITransport(app=server.app)
    created_doc = False
    try:
        with patch("lib.razorpay.find_by_phone", new=AsyncMock(return_value=_mock_payment())):
            async with httpx.AsyncClient(transport=transport, base_url="http://test/api") as c:
                body = {
                    "prediction": {"exam": EXAM, "score": 88.5, "category": "General", "cities": []},
                    "name": "Test Agent", "phone": PHONE, "email": "delivered@resend.dev", "payment_id": "",
                }
                r = await c.post("/predictor/unlock", json=body)
                assert r.status_code == 200, r.text
                created_doc = True
                out = r.json()
                assert out["payment_id"] == PAYMENT_ID
                assert out["amount"] == FEE_RUPEES
                assert out["exam"] == EXAM
                assert "*" in out["email"]  # masked
                assert "*" in out["phone"]  # masked
                assert out["pdf_url"]

                set_cookie = r.headers.get("set-cookie", "")
                assert set_cookie.startswith("ds_unlocks="), set_cookie
                token = set_cookie.split(";", 1)[0].split("=", 1)[1]
                cookie_hdr = {"Cookie": f"ds_unlocks={token}"}

                pdf = await c.get("http://test" + out["pdf_url"], headers=cookie_hdr)
                assert pdf.status_code == 200
                assert pdf.headers["content-type"] == "application/pdf"
                assert pdf.content[:4] == b"%PDF"

                acc = await c.get("/predictor/access", params={"exam": EXAM, "score": 88.5}, headers=cookie_hdr)
                assert acc.status_code == 200 and acc.json()["paid"] is True, acc.text
    finally:
        if created_doc:
            await db.predictor_unlocks.delete_many({"payment_id": PAYMENT_ID})
