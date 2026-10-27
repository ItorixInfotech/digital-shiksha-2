"""Admin login lockout: too many wrong passwords -> locked for a few minutes.

Two counters in Mongo `login_attempts` (TTL-cleaned):
- per visitor IP: 5 wrong tries in 15 min locks that IP for 15 min;
- per real account: 10 wrong passwords for the correct username from any IPs locks the login for 15 min
  (stops guessing spread over many IPs; can't be triggered by someone who doesn't know the username).
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request

from lib.db import db

WINDOW = timedelta(minutes=15)
LOCK = timedelta(minutes=15)
IP_MAX, ACCOUNT_MAX = 5, 10


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() if fwd else "") or request.headers.get("x-real-ip", "") or (request.client.host if request.client else "unknown")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


async def check_locked(ip: str) -> None:
    now = _now()
    async for d in db.login_attempts.find({"key": {"$in": [f"ip:{ip}", "account"]}, "locked_until": {"$ne": None}}):
        until = _aware(d["locked_until"])
        if until > now:
            mins = max(1, round((until - now).total_seconds() / 60))
            raise HTTPException(status_code=429, detail=f"Too many wrong attempts. Login is locked, try again in {mins} minute{'s' if mins > 1 else ''}.",
                                headers={"Retry-After": str(int((until - now).total_seconds()) + 1)})


async def _bump(key: str, limit: int) -> None:
    now = _now()
    d = await db.login_attempts.find_one({"key": key})
    if not d or _aware(d["window_start"]) + WINDOW < now:  # fresh window
        fails, start = 1, now
    else:
        fails, start = d["fails"] + 1, _aware(d["window_start"])
    locked = now + LOCK if fails >= limit else None
    await db.login_attempts.update_one({"key": key}, {"$set": {
        "key": key, "fails": 0 if locked else fails, "window_start": now if locked else start,
        "locked_until": locked, "expires_at": (locked or start + WINDOW) + timedelta(minutes=1)}}, upsert=True)


async def record_failure(ip: str, username_ok: bool) -> None:
    await _bump(f"ip:{ip}", IP_MAX)
    if username_ok:
        await _bump("account", ACCOUNT_MAX)


async def record_success(ip: str) -> None:
    await db.login_attempts.delete_many({"key": {"$in": [f"ip:{ip}", "account"]}})
