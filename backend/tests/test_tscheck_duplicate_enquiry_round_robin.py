"""Duplicate enquiry (same phone within 10 min) must not consume an auto-assign
round-robin turn. Uses two throwaway counsellors + auto_assign ON, restores the
previous auto_assign setting and deletes its own counsellors/leads afterwards.
"""
import random

import pytest


@pytest.fixture
def admin_client(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "DigitalShiksha@2026"})
    assert resp.status_code == 200, resp.text
    # The admin cookie is Secure; httpx (correctly) won't replay a Secure cookie over our
    # plain-http test connection, so forward it explicitly for the rest of this client's life.
    token = resp.cookies.get("ds_admin")
    client.headers["Cookie"] = f"ds_admin={token}"
    return client


def test_duplicate_enquiry_skips_round_robin_turn(admin_client):
    suffix = random.randint(100000, 999999)
    phones = [f"9{random.randint(100000000, 999999999)}" for _ in range(3)]

    prev_settings = admin_client.get("/admin/counsellor-settings").json()

    c1 = admin_client.post("/admin/counsellors", json={"name": f"Tscheck RR One {suffix}", "phone": phones[0], "active": True})
    c2 = admin_client.post("/admin/counsellors", json={"name": f"Tscheck RR Two {suffix}", "phone": phones[1], "active": True})
    assert c1.status_code == 201, c1.text
    assert c2.status_code == 201, c2.text
    c1_id, c2_id = c1.json()["id"], c2.json()["id"]

    created_lead_ids = []
    try:
        put = admin_client.put("/admin/counsellor-settings", json={"auto_assign": True, "reminder_template_sid": ""})
        assert put.status_code == 200, put.text

        lead_phone = phones[2]
        e1 = admin_client.post("/enquiries", json={"name": f"Tscheck RR Lead A {suffix}", "phone": lead_phone,
                                                     "source": "tscheck-duplicate-rr"})
        assert e1.status_code == 201, e1.text
        lead1 = e1.json()
        created_lead_ids.append(lead1["id"])
        first_counsellor = lead1["counsellor_id"]
        assert first_counsellor in (c1_id, c2_id), f"expected an assigned counsellor, got {first_counsellor}"

        # Immediate resubmission, same phone -> duplicate, must NOT get a counsellor assigned
        e2 = admin_client.post("/enquiries", json={"name": f"Tscheck RR Lead A dup {suffix}", "phone": lead_phone,
                                                     "source": "tscheck-duplicate-rr"})
        assert e2.status_code == 201, e2.text
        lead2 = e2.json()
        created_lead_ids.append(lead2["id"])
        assert lead2["counsellor_id"] is None, f"duplicate enquiry should not consume a round-robin turn: {lead2}"

        # Next enquiry from a NEW phone should go to the OTHER counsellor (turn wasn't consumed by the dup)
        new_phone = f"9{random.randint(100000000, 999999999)}"
        e3 = admin_client.post("/enquiries", json={"name": f"Tscheck RR Lead B {suffix}", "phone": new_phone,
                                                     "source": "tscheck-duplicate-rr"})
        assert e3.status_code == 201, e3.text
        lead3 = e3.json()
        created_lead_ids.append(lead3["id"])
        second_counsellor = lead3["counsellor_id"]
        assert second_counsellor in (c1_id, c2_id)
        other = c2_id if first_counsellor == c1_id else c1_id
        assert second_counsellor == other, (
            f"expected round robin to move to the other counsellor {other}, got {second_counsellor}"
        )
    finally:
        # restore auto-assign and clean up test fixtures
        admin_client.put("/admin/counsellor-settings", json={
            "auto_assign": prev_settings.get("auto_assign", False),
            "reminder_template_sid": prev_settings.get("reminder_template_sid", ""),
        })
        for lid in created_lead_ids:
            admin_client.delete(f"/admin/leads/{lid}")
        admin_client.delete(f"/admin/counsellors/{c1_id}")
        admin_client.delete(f"/admin/counsellors/{c2_id}")
