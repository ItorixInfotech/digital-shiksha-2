"""Admin-only full database export as a downloadable JSON file."""
from datetime import datetime, timezone

from bson import json_util
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from lib.db import db
from routers.admin import require_admin

router = APIRouter()


@router.get("/admin/export")
async def export_database(_: str = Depends(require_admin)):
    """Dumps every collection (MongoDB Extended JSON, so dates/ObjectIds round-trip with mongoimport/json_util)."""
    names = sorted(n for n in await db.list_collection_names() if not n.startswith("system."))
    collections = {n: await db[n].find({}).to_list(None) for n in names}
    now = datetime.now(timezone.utc)
    payload = {
        "exported_at": now,
        "database": db.name,
        "counts": {n: len(docs) for n, docs in collections.items()},
        "collections": collections,
    }
    body = json_util.dumps(payload, json_options=json_util.RELAXED_JSON_OPTIONS, indent=2, ensure_ascii=False)
    return Response(
        content=body.encode("utf-8"),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="digital-shiksha-db-{now.strftime("%Y-%m-%d-%H%M")}.json"',
            "Cache-Control": "no-store",
        },
    )
