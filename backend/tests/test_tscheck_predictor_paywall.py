"""Paid MHT CET (Engineering ₹1500 / Pharmacy ₹599) predictor paywall.

Covers: 402 without unlock, unlock sets httpOnly cookie + grants access, reused payment_id
rejected, free exams never paywalled, PDF requires the same cookie.
"""
import secrets

import httpx


def _pay_id() -> str:
    return "pay_TESTAGENT" + secrets.token_hex(6)


def test_mhtcet_predict_without_cookie_returns_402(client: httpx.Client):
    score = 61.11
    r = client.post("/predictor", json={"exam": "MHT CET", "score": score, "category": "General", "cities": ["Pune"]})
    assert r.status_code == 402, r.text


def test_pdf_without_cookie_returns_402(client: httpx.Client):
    r = client.get("/predictor/pdf", params={"exam": "MHT CET", "score": 61.12, "category": "General", "cities": "Pune"})
    assert r.status_code == 402, r.text


def test_unlock_grants_access_cookie_and_pdf_then_rejects_reused_payment_id(client: httpx.Client):
    score = 61.13
    pay_id = _pay_id()
    phone = "9876500011"
    prediction = {"exam": "MHT CET", "score": score, "category": "General", "cities": ["Pune"]}

    # Before unlock: access is false.
    acc = client.get("/predictor/access", params={"exam": "MHT CET", "score": score})
    assert acc.status_code == 200 and acc.json()["paid"] is False, acc.text

    r = client.post("/predictor/unlock", json={
        "prediction": prediction, "name": "Test Agent", "phone": phone,
        "email": "delivered@resend.dev", "payment_id": pay_id,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["payment_id"] == pay_id and body["exam"] == "MHT CET" and body["score"] == score

    # The unlock cookie is Secure, so plain-HTTP httpx won't auto-resend it (expected per spec —
    # browsers test this over HTTPS/localhost). Extract the raw token and send it back explicitly.
    set_cookie = r.headers.get("set-cookie", "")
    assert set_cookie.startswith("ds_unlocks="), f"unlock cookie not set: {set_cookie}"
    token = set_cookie.split(";", 1)[0].split("=", 1)[1]
    cookie_hdr = {"Cookie": f"ds_unlocks={token}"}

    acc2 = client.get("/predictor/access", params={"exam": "MHT CET", "score": score}, headers=cookie_hdr)
    assert acc2.status_code == 200 and acc2.json()["paid"] is True, acc2.text

    # Prediction now succeeds with the cookie.
    pred = client.post("/predictor", json=prediction, headers=cookie_hdr)
    assert pred.status_code == 200, pred.text
    assert pred.json()["total"] >= 0

    # PDF now succeeds with the cookie.
    pdf = client.get("/predictor/pdf", params={"exam": "MHT CET", "score": score, "category": "General", "cities": "Pune"}, headers=cookie_hdr)
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf" and pdf.content[:4] == b"%PDF", pdf.text

    # Reusing the same payment_id for a different score is rejected.
    r2 = client.post("/predictor/unlock", json={
        "prediction": {**prediction, "score": 61.14}, "name": "Test Agent", "phone": phone,
        "email": "delivered@resend.dev", "payment_id": pay_id,
    })
    assert r2.status_code == 409, r2.text
    assert "already been used" in r2.json()["detail"]


def test_pharmacy_fee_599_and_free_exams_have_no_fee(client: httpx.Client):
    r = client.get("/predictor/exams")
    assert r.status_code == 200, r.text
    by_name = {e["name"]: e for e in r.json()}
    assert by_name["MHT CET"]["fee"] == 1500 and by_name["MHT CET"]["payment_link"] == "https://rzp.io/rzp/6wXdLUk"
    assert by_name["MHT CET Pharmacy"]["fee"] == 599 and by_name["MHT CET Pharmacy"]["payment_link"] == "https://rzp.io/rzp/6vvZNmq"
    for free_exam in ("JEE Main", "NEET UG", "MAH MBA CET"):
        assert by_name[free_exam]["fee"] == 0, free_exam

    # A free exam never needs unlock, no cookie required.
    r2 = client.post("/predictor", json={"exam": "JEE Main", "score": 95.0, "category": "General", "cities": []})
    assert r2.status_code == 200, r2.text
