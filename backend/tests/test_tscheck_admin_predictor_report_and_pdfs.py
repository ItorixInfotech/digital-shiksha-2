"""Admin: every prediction available as PDF.

Mints a JWT with JWT_SECRET from backend/.env (claims sub, pv, exp) and sets it as the
ds_admin cookie — never logs in with or touches the owner's password (db.admin_auth untouched).
"""
import os
import sys
import time
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import jwt
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tests.conftest import api_url  # noqa: E402

import server  # noqa: E402
from lib.db import db  # noqa: E402


async def _admin_cookie() -> str:
    from lib import admin_auth
    secret = os.environ["JWT_SECRET"]
    pv = await admin_auth.session_version()  # must match the current session version or the token is rejected
    payload = {"sub": "tscheck-admin", "pv": pv, "exp": int(time.time()) + 600}
    return jwt.encode(payload, secret, algorithm="HS256")


def _mock_payment(payment_id: str, amount: int):
    return {"id": payment_id, "amount": amount, "status": "captured", "currency": "INR",
            "contact": "+919876543211", "email": "delivered@resend.dev", "created_at": 1700000001}


@pytest.mark.asyncio
async def test_admin_predictor_report_and_pdfs_require_cookie_and_work():
    cookie = await _admin_cookie()
    headers = {"Cookie": f"ds_admin={cookie}"}
    payment_id = f"pay_TSCHECKADM{uuid.uuid4().hex[:6]}"
    score = 91.0
    created_doc = False
    try:
        # 401 without the cookie for the report + ZIP endpoints (over HTTP, against the running server).
        async with httpx.AsyncClient(base_url=api_url(), timeout=30) as c:
            r1 = await c.get("/admin/predictor-report")
            assert r1.status_code == 401, r1.text
            r2 = await c.get("/admin/predictor-payments/pdfs.zip")
            assert r2.status_code == 401, r2.text

        # Every exam is paid -> unlock in-process (mocked Razorpay) to get a cookie, then log a
        # real prediction via POST /predictor so it shows up in the admin report.
        transport = httpx.ASGITransport(app=server.app)
        with patch("lib.razorpay.find_by_phone", new=AsyncMock(return_value=_mock_payment(payment_id, 119900))):
            async with httpx.AsyncClient(transport=transport, base_url="http://test/api") as c:
                unlock = await c.post("/predictor/unlock", json={
                    "prediction": {"exam": "MAH MBA CET", "score": score, "category": "General", "cities": []},
                    "name": "Tscheck Admin Fixture", "phone": "9876543211", "payment_id": "",
                })
                assert unlock.status_code == 200, unlock.text
                created_doc = True
                set_cookie = unlock.headers.get("set-cookie", "")
                token = set_cookie.split(";", 1)[0].split("=", 1)[1]
                predict = await c.post("/predictor", json={
                    "exam": "MAH MBA CET", "score": score, "category": "General", "cities": [],
                }, headers={"Cookie": f"ds_unlocks={token}"})
                assert predict.status_code == 200, predict.text

        async with httpx.AsyncClient(base_url=api_url(), timeout=30) as c:
            report = await c.get("/admin/predictor-report", headers=headers)
            assert report.status_code == 200, report.text
            body = report.json()
            assert isinstance(body.get("recent"), list) and len(body["recent"]) <= 200
            assert body["recent"], "admin predictor-report returned no recent rows"
            row = next((d for d in body["recent"] if d["score"] == score and d["exam"] == "MAH MBA CET"), body["recent"][0])
            assert "params" in row
            log_id = row["id"]

            pdf = await c.get(f"/admin/predictions/{log_id}/pdf", headers=headers)
            assert pdf.status_code == 200, pdf.text
            assert pdf.headers["content-type"] == "application/pdf"
            assert pdf.content[:4] == b"%PDF"

            zipped = await c.get("/admin/predictor-payments/pdfs.zip", headers=headers)
            assert zipped.status_code == 200, zipped.text
            assert zipped.headers["content-type"] == "application/zip"
    finally:
        if created_doc:
            await db.predictor_unlocks.delete_many({"payment_id": payment_id})
