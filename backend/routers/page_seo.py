"""Page Manager: per-URL SEO overrides (H1, meta, canonical, robots, share image), schema.org JSON-LD blocks for any page,
site-wide Organization/LocalBusiness schema defaults, and the bulk title/description fixer."""
import re
from collections import Counter
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.schema_check import formatted_blocks, validate_override, validate_schema
from lib.seo_score import DESC_MAX, TITLE_MAX, effective
from models.seo import (BulkSeoIn, BulkSeoOut, PageOverride, PageOverrideIn, PageOverrideSaveOut, SchemaValidateIn, SchemaValidateOut,
                        SitePage, SiteSchema, SiteSchemaSaveOut, TitleAuditRow)
from routers.admin import require_admin
from routers.landing import list_landing
from lib.year_rollover import EXAM_YEAR
from routers.seo import STATIC_PAGES, _pages, _year

router = APIRouter()
FIELDS = ("h1", "meta_title", "meta_description", "keywords", "canonical_url", "og_image", "noindex", "schemas")


def _norm(path: str) -> str:
    p = "/" + path.strip().strip("/")
    return p if p != "//" else "/"


@router.get("/page-seo", response_model=Optional[PageOverride])
async def get_page_override(path: str):
    """Public: the admin override for one URL path (null when none). Read by every page's <Seo>."""
    return await db.page_overrides.find_one({"path": _norm(path)}, {"_id": 0})


@router.get("/admin/page-seo/pages", response_model=List[SitePage])
async def list_site_pages(_: str = Depends(require_admin)):
    y = _year()
    pages = [SitePage(path=p, label=label, kind="static", default_title=t.format(y=EXAM_YEAR if k == "exams" else y)) for k, label, p, t, _d in STATIC_PAGES]
    pages += [SitePage(path=f"/{s.slug}", label=s.default_title, kind="landing", default_title=s.default_title) for s in await list_landing()]
    for kind, coll, prefix, name in (("colleges", "colleges", "/colleges", "name"), ("courses", "courses", "/courses", "name"),
                                     ("exams", "exams", "/exams", "name"), ("articles", "articles", "/news", "title")):
        async for d in db[coll].find({}, {"_id": 0, "slug": 1, name: 1}).sort(name, 1):
            pages.append(SitePage(path=f"{prefix}/{d['slug']}", label=d.get(name, d["slug"]), kind=kind))
    ov = {o["path"]: o async for o in db.page_overrides.find({}, {"_id": 0})}
    for p in pages:
        o = ov.get(p.path)
        if o:
            p.has_override = True
            p.override_fields = [f for f in FIELDS if o.get(f) not in (None, "", [], False)]
    known = {p.path for p in pages}
    pages += [SitePage(path=path, label=path, kind="custom", has_override=True, override_fields=[f for f in FIELDS if o.get(f) not in (None, "", [], False)])
              for path, o in ov.items() if path not in known]
    return pages


@router.get("/admin/page-seo", response_model=Optional[PageOverride])
async def get_override_admin(path: str, _: str = Depends(require_admin)):
    return await db.page_overrides.find_one({"path": _norm(path)}, {"_id": 0})


@router.put("/admin/page-seo", response_model=PageOverrideSaveOut)
async def save_override(body: PageOverrideIn, _: str = Depends(require_admin)):
    body.path = _norm(body.path)
    body.keywords = [k.strip() for k in body.keywords if k.strip()][:10]
    errors, warnings = validate_override(body)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors, "warnings": warnings})
    body.schemas = formatted_blocks(body.schemas)
    doc = PageOverride(**body.model_dump(), updated_at=datetime.now(timezone.utc).isoformat())
    await db.page_overrides.update_one({"path": body.path}, {"$set": doc.model_dump()}, upsert=True)
    return PageOverrideSaveOut(page=doc, warnings=warnings)


@router.delete("/admin/page-seo", status_code=204)
async def delete_override(path: str, _: str = Depends(require_admin)):
    await db.page_overrides.delete_one({"path": _norm(path)})


@router.post("/admin/schema/validate", response_model=SchemaValidateOut)
async def validate_schema_block(body: SchemaValidateIn, _: str = Depends(require_admin)):
    errors, warnings, formatted = validate_schema(body.type, body.json_text)
    return SchemaValidateOut(valid=not errors, errors=errors, warnings=warnings, formatted=formatted)


# ---------------- Site-wide schema defaults ----------------
SITE_KEY = "site_schema"
_HOURS = re.compile(r"^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)* ([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-4]):[0-5]\d$")
SOCIAL = {"facebook": "facebook.com", "instagram": "instagram.com", "youtube": "youtube.com", "linkedin": "linkedin.com", "twitter": ("twitter.com", "x.com")}


async def _site_schema() -> SiteSchema:
    saved = await db.settings.find_one({"key": SITE_KEY}, {"_id": 0, "key": 0}) or {}
    return SiteSchema(**saved)


def _check_site(s: SiteSchema) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    if s.org_type not in ("Organization", "EducationalOrganization"):
        errors.append("Organization type must be Organization or EducationalOrganization.")
    if s.logo and not re.match(r"^https?://", s.logo):
        errors.append("Logo must be a full https:// address.")
    if s.email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s.email):
        errors.append("Email address is not valid.")
    if s.phone and not re.match(r"^\+?[\d\s-]{8,20}$", s.phone):
        errors.append("Phone should look like +91-8149689468.")
    if not re.match(r"^[A-Z]{2}$", s.country):
        errors.append("Country must be a 2-letter code, e.g. IN.")
    if (s.latitude is None) != (s.longitude is None):
        errors.append("Enter both latitude and longitude, or neither.")
    if s.latitude is not None and not -90 <= s.latitude <= 90:
        errors.append("Latitude must be between -90 and 90.")
    if s.longitude is not None and not -180 <= s.longitude <= 180:
        errors.append("Longitude must be between -180 and 180.")
    for h in s.opening_hours:
        if not _HOURS.match(h):
            errors.append(f'Opening hours "{h}" must look like "Mo-Sa 10:00-19:00".')
    if s.map_url and not re.match(r"^https://(www\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)", s.map_url):
        errors.append("Map link must be a Google Maps address (https://www.google.com/maps/… or https://maps.app.goo.gl/…).")
    links = {}
    for field, host in SOCIAL.items():
        url = getattr(s, field)
        if not url:
            continue
        if not url.startswith("https://"):
            errors.append(f"{field.title()} link must start with https://")
        elif not any(h in url for h in (host if isinstance(host, tuple) else (host,))):
            warnings.append(f"{field.title()} link does not point to {host if isinstance(host, str) else host[0]} — check it is the right page.")
        if url in links:
            warnings.append(f"{field.title()} link is the same as the {links[url].title()} link.")
        links.setdefault(url, field)
    if s.apply_local_business:
        if not s.street_address:
            warnings.append("LocalBusiness: add a street address so Google can show you on Maps.")
        if not s.postal_code:
            warnings.append("LocalBusiness: add a PIN code.")
        if not s.opening_hours:
            warnings.append("LocalBusiness: add opening hours.")
    return errors, warnings


@router.get("/site-schema", response_model=SiteSchema)
async def get_site_schema():
    """Public: Organization + LocalBusiness details that every page's <Seo> turns into JSON-LD."""
    return await _site_schema()


@router.put("/admin/site-schema", response_model=SiteSchemaSaveOut)
async def save_site_schema(body: SiteSchema, _: str = Depends(require_admin)):
    body.opening_hours = [h.strip() for h in body.opening_hours if h.strip()]
    for f in ("name", "legal_name", "description", "logo", "phone", "email", "street_address", "locality", "region", "postal_code",
              "price_range", "map_url", *SOCIAL):
        setattr(body, f, getattr(body, f).strip())
    body.country = body.country.strip().upper()
    errors, warnings = _check_site(body)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors, "warnings": warnings})
    body.updated_at = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"key": SITE_KEY}, {"$set": {"key": SITE_KEY, **body.model_dump()}}, upsert=True)
    return SiteSchemaSaveOut(site=body, warnings=warnings)


# ---------------- Bulk title / description fixer ----------------
SUFFIX = " | Digital Shiksha"


def _fit(t: str) -> str:
    """Mirror of fitTitle in Seo.tsx: automatic titles drop the brand suffix when over the limit."""
    return t[: -len(SUFFIX)] if len(t) > TITLE_MAX and t.endswith(SUFFIX) else t


def _issues(title: str, desc: str) -> list[str]:
    out = []
    out += ["title_missing"] if not title else ["title_long"] if len(title) > TITLE_MAX else ["title_short"] if len(title) < 30 else []
    out += ["desc_missing"] if not desc else ["desc_long"] if len(desc) > DESC_MAX else ["desc_short"] if len(desc) < 70 else []
    return out


async def _page_heads() -> list[dict]:
    """Effective <head> values for every public page, mirroring <Seo>: Page Manager override > record SEO > automatic."""
    y = _year()
    ov = {o["path"]: o async for o in db.page_overrides.find({}, {"_id": 0, "path": 1, "meta_title": 1, "meta_description": 1,
                                                                  "canonical_url": 1, "og_image": 1, "noindex": 1})}
    rows: list[dict] = []
    for p in (await _pages()).pages:
        rows.append({"path": p.path, "label": p.label, "kind": "static", "title": p.meta_title or p.default_title,
                     "description": p.meta_description or p.default_description, "og_image": p.og_image, "noindex": p.noindex})
    for s in await list_landing():
        seo = s.override.seo if s.override else None
        rows.append({"path": f"/{s.slug}", "label": s.label, "kind": "landing", "title": (seo and seo.meta_title) or s.default_title,
                     "description": (seo and seo.meta_description) or s.default_description, "og_image": "", "noindex": False})
    fields = {"colleges": ("name", "short_name", "city", "exams_accepted", "avg_package", "nirf_rank", "image", "logo"),
              "courses": ("name", "full_name", "overview", "duration", "avg_fees", "image"),
              "exams": ("name", "full_name", "exam_date", "image"), "articles": ("title", "excerpt", "content", "image")}
    for kind, prefix in (("colleges", "/colleges"), ("courses", "/courses"), ("exams", "/exams"), ("articles", "/news")):
        proj = {"_id": 0, "slug": 1, "seo": 1, **{f: 1 for f in fields[kind]}}
        async for d in db[kind].find({}, proj):
            t, desc, seo = effective(kind, d, y)
            rows.append({"path": f"{prefix}/{d['slug']}", "label": d.get("name") or d.get("title") or d["slug"], "kind": kind, "title": t,
                         "description": desc, "canonical": seo.get("canonical_url", ""), "og_image": seo.get("og_image") or d.get("image") or "",
                         "noindex": bool(seo.get("noindex"))})
    for r in rows:
        o = ov.get(r["path"], {})
        r["title_custom"], r["description_custom"] = o.get("meta_title", ""), o.get("meta_description", "")
        r["title"] = r["title_custom"] or _fit(r["title"].strip())
        r["description"] = r["description_custom"] or r["description"].strip()
        r["canonical"] = o.get("canonical_url") or r.get("canonical") or r["path"]
        r["og_image"] = o.get("og_image") or r["og_image"]
        r["noindex"] = bool(o.get("noindex")) or r["noindex"]
    return rows


@router.get("/admin/page-seo/audit", response_model=List[TitleAuditRow])
async def audit_titles(_: str = Depends(require_admin)):
    """Every public page with the title/description Google sees and what is wrong with them."""
    out = [TitleAuditRow(**{k: r[k] for k in TitleAuditRow.model_fields if k != "issues"}, issues=[]) for r in await _page_heads()]
    dup = Counter(r.title.lower() for r in out if r.title)
    for r in out:
        r.issues = _issues(r.title, r.description) + (["title_duplicate"] if r.title and dup[r.title.lower()] > 1 else [])
    return out


@router.put("/admin/page-seo/bulk", response_model=BulkSeoOut)
async def bulk_save_titles(body: BulkSeoIn, _: str = Depends(require_admin)):
    """Save title/description for many pages at once (empty = back to automatic). Other Page Manager fields are kept."""
    now = datetime.now(timezone.utc).isoformat()
    for it in body.items:
        path = _norm(it.path)
        cur = await db.page_overrides.find_one({"path": path}, {"_id": 0}) or {"path": path}
        doc = PageOverride(**{**cur, "meta_title": it.meta_title.strip(), "meta_description": it.meta_description.strip(), "updated_at": now})
        await db.page_overrides.update_one({"path": path}, {"$set": doc.model_dump()}, upsert=True)
    return BulkSeoOut(saved=len(body.items))
