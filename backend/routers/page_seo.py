"""Page Manager: per-URL SEO overrides (H1, meta, canonical, robots, share image) and schema.org JSON-LD blocks for any page."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.schema_check import formatted_blocks, validate_override, validate_schema
from models.seo import PageOverride, PageOverrideIn, PageOverrideSaveOut, SchemaValidateIn, SchemaValidateOut, SitePage
from routers.admin import require_admin
from routers.landing import list_landing
from lib.year_rollover import EXAM_YEAR
from routers.seo import STATIC_PAGES, _year

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
