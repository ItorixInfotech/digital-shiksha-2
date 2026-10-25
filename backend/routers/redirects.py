"""Old-page redirects: public list (applied by the SPA on every navigation) + admin CRUD."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from models.redirect import Redirect, RedirectIn, norm_path
from routers.admin import require_admin

router = APIRouter()
SEED_FLAG = "redirects_seeded"


async def seed_redirects() -> None:
    """Insert the user's starter redirect (/blog -> /news) once; never re-added after the admin deletes it."""
    if await db.settings.find_one({"key": SEED_FLAG}):
        return
    if not await db.redirects.find_one({"from_path": "/blog"}):
        await db.redirects.insert_one(Redirect(from_path="/blog", to_path="/news", include_subpages=True).model_dump())
    await db.settings.update_one({"key": SEED_FLAG}, {"$set": {"key": SEED_FLAG, "done": True}}, upsert=True)


async def _check(body: RedirectIn, own_id: str | None = None) -> None:
    if norm_path(body.to_path) == body.from_path:
        raise HTTPException(status_code=422, detail="Old and new address are the same")
    dup = await db.redirects.find_one({"from_path": body.from_path}, {"id": 1})
    if dup and dup["id"] != own_id:
        raise HTTPException(status_code=409, detail="A redirect for this old address already exists")


@router.get("/redirects", response_model=List[RedirectIn])
async def public_redirects():
    return await db.redirects.find({}, {"_id": 0, "from_path": 1, "to_path": 1, "include_subpages": 1}).to_list(2000)


@router.get("/admin/redirects", response_model=List[Redirect])
async def list_redirects(_: str = Depends(require_admin)):
    return await db.redirects.find({}, {"_id": 0}).sort("from_path", 1).to_list(2000)


@router.post("/admin/redirects", response_model=Redirect, status_code=201)
async def create_redirect(body: RedirectIn, _: str = Depends(require_admin)):
    await _check(body)
    r = Redirect(**body.model_dump())
    await db.redirects.insert_one(r.model_dump())
    return r


@router.put("/admin/redirects/{rid}", response_model=Redirect)
async def update_redirect(rid: str, body: RedirectIn, _: str = Depends(require_admin)):
    await _check(body, rid)
    doc = await db.redirects.find_one_and_update({"id": rid}, {"$set": body.model_dump()}, projection={"_id": 0}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Redirect not found")
    return doc


@router.delete("/admin/redirects/{rid}", status_code=204)
async def delete_redirect(rid: str, _: str = Depends(require_admin)):
    if not (await db.redirects.delete_one({"id": rid})).deleted_count:
        raise HTTPException(status_code=404, detail="Redirect not found")
