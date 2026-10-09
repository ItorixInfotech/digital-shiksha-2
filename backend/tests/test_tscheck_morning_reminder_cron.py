"""Morning reminder cron: must ack fast and be protected by Bearer WEBHOOK_CRON_SECRET +
idempotent on X-Webhook-Id.
"""
import os
import uuid

import pytest


@pytest.fixture
def secret():
    s = os.environ.get("WEBHOOK_CRON_SECRET", "")
    assert s, "WEBHOOK_CRON_SECRET must be set in backend/.env for this test"
    return s


def test_no_auth_rejected(client):
    resp = client.post("/cron/morning-reminders", json={})
    assert resp.status_code == 401, resp.text


def test_valid_bearer_acks_fast_and_idempotent(client, secret):
    webhook_id = f"tscheck-morning-{uuid.uuid4()}"
    headers = {"Authorization": f"Bearer {secret}", "X-Webhook-Id": webhook_id}

    resp1 = client.post("/cron/morning-reminders", json={}, headers=headers)
    assert resp1.status_code == 202, resp1.text
    assert resp1.elapsed.total_seconds() < 5, "cron must ack fast"
    body1 = resp1.json()
    assert body1.get("duplicate") is not True

    resp2 = client.post("/cron/morning-reminders", json={}, headers=headers)
    assert resp2.status_code == 202, resp2.text
    assert resp2.json().get("duplicate") is True, resp2.text


def test_non_json_body_rejected(client, secret):
    headers = {"Authorization": f"Bearer {secret}", "X-Webhook-Id": f"tscheck-morning-badbody-{uuid.uuid4()}"}
    resp = client.post("/cron/morning-reminders", content=b"not-json", headers={**headers, "Content-Type": "text/plain"})
    assert resp.status_code == 400, resp.text
