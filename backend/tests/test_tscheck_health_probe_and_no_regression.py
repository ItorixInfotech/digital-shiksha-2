"""Covers: production readiness probe fix (/health at root + /api/health alias) and
no-regression to existing API routes after editing backend/server.py.
"""

import httpx


def test_root_health_probe(backend_url):
    """GET /health (outside /api, for the k8s readiness probe) -> 200 {"status":"ok"}."""
    resp = httpx.get(f"{backend_url}/health", timeout=30.0)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "ok"}


def test_api_health_alias(client):
    resp = client.get("/health")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "ok"}


def test_root_api_message(client):
    resp = client.get("/")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"message": "Digital Shiksha API"}


def test_colleges_list(client):
    resp = client.get("/colleges", params={"limit": 2})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_admin_login_and_stats(client):
    login = client.post(
        "/auth/login",
        json={"username": "admin", "password": "DigitalShiksha@2026"},
    )
    assert login.status_code == 200, login.text
    assert "ds_admin" in login.cookies

    client.cookies.set("ds_admin", login.cookies["ds_admin"])
    stats = client.get("/admin/stats")
    assert stats.status_code == 200, stats.text


def test_admin_login_wrong_password_rejected(client):
    login = client.post(
        "/auth/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert login.status_code == 401, login.text


def test_sitemap_xml(client):
    resp = client.get("/sitemap.xml")
    assert resp.status_code == 200, resp.text
    assert "<?xml" in resp.text or "<urlset" in resp.text
