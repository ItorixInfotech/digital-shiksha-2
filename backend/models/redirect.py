import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator


def norm_path(p: str) -> str:
    """'/Blog/' -> '/blog' (lower-case, no trailing slash, no query)."""
    p = (p or "").strip().split("?")[0].split("#")[0].lower()
    return p.rstrip("/") or "/"


class RedirectIn(BaseModel):
    from_path: str = Field(min_length=2, max_length=300)
    to_path: str = Field(min_length=1, max_length=500)
    include_subpages: bool = True  # /blog also sends /blog/any-post to the target

    @field_validator("from_path")
    @classmethod
    def _from(cls, v: str) -> str:
        v = norm_path(v)
        if not v.startswith("/") or v == "/":
            raise ValueError("Old address must start with / (e.g. /blog)")
        if v.split("/")[1] in ("admin", "api"):
            raise ValueError("Admin and API addresses cannot be redirected")
        return v

    @field_validator("to_path")
    @classmethod
    def _to(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("/") or v.startswith("https://") or v.startswith("http://")):
            raise ValueError("New address must start with / (e.g. /news) or https://")
        return v


class Redirect(RedirectIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
