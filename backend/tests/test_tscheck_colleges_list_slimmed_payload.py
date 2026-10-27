"""Colleges list stays complete after slimming the list API.

GET /api/colleges must no longer carry heavy per-college fields (overview, admission,
courses, cutoffs, seo, faqs, facilities) while still giving every card the fields the
UI needs (slug, name, city, logo, fees_min), and the whole payload stays small (<200KB).
"""

from .conftest import api_url


def test_colleges_list_slimmed_and_under_200kb(client):
    resp = client.get(api_url("/colleges"), params={"stream": "Engineering"})
    assert resp.status_code == 200, resp.text
    raw = resp.content
    size_kb = len(raw) / 1024
    assert size_kb < 200, f"payload too large: {size_kb:.1f}KB"

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0

    required_fields = {"slug", "name", "city", "logo", "fees_min"}
    heavy_fields = ["overview", "admission", "courses", "cutoffs", "seo", "faqs", "facilities"]

    for item in data:
        missing = required_fields - item.keys()
        assert not missing, f"college {item.get('slug')} missing required fields: {missing}"
        assert item["slug"], "slug must be non-empty"
        assert item["name"], "name must be non-empty"
        assert item["city"], "city must be non-empty"
        assert item["logo"], "logo must be non-empty"
        assert item["fees_min"] is not None

        # Slimmed: any heavy field present must be empty/falsy -- including nested dict values
        # (e.g. seo: {meta_title: "", ...}) -- not the full detail payload.
        def is_slimmed(val):
            if val in (None, "", [], {}, False):
                return True
            if isinstance(val, dict):
                return all(is_slimmed(v) for v in val.values())
            return False

        for hf in heavy_fields:
            if hf in item:
                val = item[hf]
                assert is_slimmed(val), (
                    f"college {item.get('slug')} field '{hf}' not slimmed: {val!r}"
                )

    engineering_count = sum(1 for c in data if "Engineering" in c.get("streams", []))
    assert engineering_count >= 100, f"expected >=100 Engineering colleges, got {engineering_count}"


def test_college_detail_still_has_full_content(client):
    resp = client.get(api_url("/colleges/coep-pune"))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["slug"] == "coep-pune"
    assert data.get("logo")
    assert len(data.get("overview", "")) > 0
    assert len(data.get("courses", [])) > 0
    assert len(data.get("cutoffs", [])) > 0
