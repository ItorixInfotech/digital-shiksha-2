"""Weekly SEO report cron: auth-protected, fast ack; and the admin manual-send endpoint
returns a well-shaped SeoReportSummary (needs_fix, 5 kinds, <=10 top_fixes).
"""
import os
import uuid

import pytest


@pytest.fixture
def secret():
    s = os.environ.get("WEBHOOK_CRON_SECRET", "")
    assert s, "WEBHOOK_CRON_SECRET must be set in backend/.env for this test"
    return s


@pytest.fixture
def admin_client(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "DigitalShiksha@2026"})
    assert resp.status_code == 200, resp.text
    token = resp.cookies.get("ds_admin")
    client.headers["Cookie"] = f"ds_admin={token}"
    return client


def test_no_auth_rejected(client):
    resp = client.post("/cron/weekly-seo-report", json={})
    assert resp.status_code == 401, resp.text


def test_valid_bearer_acks_fast(client, secret):
    headers = {"Authorization": f"Bearer {secret}", "X-Webhook-Id": f"tscheck-seo-{uuid.uuid4()}"}
    resp = client.post("/cron/weekly-seo-report", json={}, headers=headers)
    assert resp.status_code == 202, resp.text
    assert resp.elapsed.total_seconds() < 5, "cron must ack fast"


def test_admin_report_send_shape(admin_client):
    resp = admin_client.post("/admin/seo/report/send")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "needs_fix" in body
    assert isinstance(body["needs_fix"], int)
    assert len(body["kinds"]) == 5, body["kinds"]
    assert len(body["top_fixes"]) <= 10
