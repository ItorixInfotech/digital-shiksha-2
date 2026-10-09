"""Shared guard for platform cron webhooks (Bearer WEBHOOK_CRON_SECRET + idempotency on run id)."""
import os
import secrets
from datetime import datetime, timezone

from fastapi import Request
from fastapi.responses import JSONResponse
from pymongo.errors import DuplicateKeyError

from lib.db import db


async def accept_cron(request: Request, job: str) -> JSONResponse | dict | None:
    """Returns a response to send immediately (401/400/duplicate) or None when the caller should queue the work."""
    expected = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not expected or not token or not secrets.compare_digest(token, expected):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    try:
        env = await request.json()
    except ValueError:
        env = None
    if not isinstance(env, dict):
        return JSONResponse({"detail": "Invalid body"}, status_code=400)
    run_id = request.headers.get("x-webhook-id") or env.get("run_id") or ""
    if run_id:
        try:
            await db.cron_runs.insert_one({"_id": f"{job}:{run_id}", "at": datetime.now(timezone.utc)})
        except DuplicateKeyError:
            return {"ok": True, "duplicate": True}
    return None
