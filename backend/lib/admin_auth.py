"""Admin password: ADMIN_PASSWORD from .env, unless reset by email link (then a PBKDF2 hash in db.admin_auth wins).

If the owner later changes ADMIN_PASSWORD in .env, the env fingerprint no longer matches and the env value takes over again.
Each reset bumps `pv`; sessions carry pv, so a reset signs out every old session.
"""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from lib.db import db

RESET_TTL = timedelta(minutes=30)
RESET_COOLDOWN = timedelta(minutes=2)
KEY = {"key": "admin"}


def _pbkdf2(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000).hex()


def _env_fp() -> str:
    return hashlib.sha256(("ds-admin:" + os.environ["ADMIN_PASSWORD"]).encode()).hexdigest()


def _sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _doc() -> dict:
    return await db.admin_auth.find_one(KEY, {"_id": 0}) or {}


async def password_ok(password: str) -> bool:
    d = await _doc()
    if d.get("password_hash") and d.get("env_fp") == _env_fp():
        return hmac.compare_digest(_pbkdf2(password, bytes.fromhex(d["salt"])), d["password_hash"])
    return secrets.compare_digest(password, os.environ["ADMIN_PASSWORD"])


async def session_version() -> int:
    return int((await _doc()).get("pv", 0))


async def create_reset_token() -> str | None:
    """Returns a raw single-use token (only its hash is stored), or None while in cooldown."""
    now = datetime.now(timezone.utc)
    d = await _doc()
    last = d.get("reset_requested_at")
    if last and (last if last.tzinfo else last.replace(tzinfo=timezone.utc)) > now - RESET_COOLDOWN:
        return None
    token = secrets.token_urlsafe(32)
    await db.admin_auth.update_one(KEY, {"$set": {**KEY, "reset_hash": _sha(token), "reset_expires": now + RESET_TTL,
                                                  "reset_requested_at": now}}, upsert=True)
    return token


async def reset_password(token: str, password: str) -> bool:
    now = datetime.now(timezone.utc)
    d = await _doc()
    exp = d.get("reset_expires")
    if not (d.get("reset_hash") and exp and hmac.compare_digest(d["reset_hash"], _sha(token))):
        return False
    if (exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)) < now:
        return False
    salt = secrets.token_bytes(16)
    res = await db.admin_auth.update_one(  # matching on reset_hash makes the token single-use even under races
        {**KEY, "reset_hash": d["reset_hash"]},
        {"$set": {"password_hash": _pbkdf2(password, salt), "salt": salt.hex(), "env_fp": _env_fp(), "updated_at": now},
         "$unset": {"reset_hash": "", "reset_expires": ""}, "$inc": {"pv": 1}})
    return res.modified_count == 1
