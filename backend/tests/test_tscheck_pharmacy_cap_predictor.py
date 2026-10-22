"""Backend tests for the Pharmacy CAP predictor support (pharmacy program added
alongside existing engineering CAP dataset).

Covers acceptance criteria:
- GET /api/predictor/cap-meta?program=pharmacy reflects the official pharmacy dataset
  (528 colleges, 559 courses, 2 branch groups, 10 full home-university names)
- POST /api/predictor with exam 'MHT CET Pharmacy' returns an official cut-off row
  (Government College of Pharmacy, Amravati / Pharm D) with correct Round I value,
  seat code, official=true and no 'Status:' prefix on the type field
- Engineering CAP (default program) is unaffected by the pharmacy addition
- Validation: unknown program -> 400; out-of-range score for MHT CET Pharmacy -> 422
"""

import pytest


def test_cap_meta_pharmacy_dataset(client):
    resp = client.get("/predictor/cap-meta", params={"program": "pharmacy"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is True
    assert data["colleges"] == 528
    assert data["courses"] == 559
    assert data["branch_groups"] == ["B.Pharmacy", "Pharm.D (Doctor of Pharmacy)"]
    assert len(data["home_universities"]) == 10
    # No truncated names (e.g. a bare "Dr. Babasaheb Ambedkar" without the rest of the name)
    assert "Dr. Babasaheb Ambedkar" not in data["home_universities"]
    for name in data["home_universities"]:
        if name.startswith("Dr. Babasaheb Ambedkar"):
            assert name != "Dr. Babasaheb Ambedkar", "truncated home university name"


def test_cap_meta_engineering_unaffected(client):
    resp = client.get("/predictor/cap-meta")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is True
    assert data["colleges"] == 387
    assert data["courses"] == 2332


def test_predictor_pharmacy_amravati_pharm_d_official_cutoff(client):
    payload = {
        "exam": "MHT CET Pharmacy",
        "score": 95.4,
        "category": "General",
        "cities": ["Amravati"],
        "home_university": "Sant Gadge Baba Amravati University",
        "branch_group": "Pharm.D (Doctor of Pharmacy)",
    }
    resp = client.post("/predictor", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    matches = [
        r for r in data["results"]
        if "Government College of Pharmacy, Amravati" in r["college_name"]
    ]
    assert matches, f"Expected college not found: {[r['college_name'] for r in data['results'][:5]]}"
    row = matches[0]
    assert row["official"] is True
    assert row["seat"] == "GOPENH"
    rounds = {rd["round"]: rd for rd in row["rounds"]}
    assert rounds[1]["percentile"] == pytest.approx(95.3576, abs=0.001)
    assert "Status:" not in row["type"]


def test_predictor_engineering_still_works(client):
    payload = {
        "exam": "MHT CET",
        "score": 97,
        "category": "General",
        "cities": ["Pune"],
    }
    resp = client.post("/predictor", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] > 0
    assert any(r["official"] is True for r in data["results"])


def test_cap_meta_invalid_program_rejected(client):
    resp = client.get("/predictor/cap-meta", params={"program": "xyz"})
    assert resp.status_code == 400, resp.text


def test_predictor_pharmacy_score_out_of_range_rejected(client):
    resp = client.post("/predictor", json={
        "exam": "MHT CET Pharmacy",
        "score": 120,
        "category": "General",
        "cities": ["Amravati"],
    })
    assert resp.status_code == 422, resp.text
