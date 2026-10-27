"""Admin image uploads (college logos), stored in Mongo so they survive redeploys; served publicly at /api/media/{id}."""
import io
import uuid
from datetime import datetime, timezone

from bson.binary import Binary
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError

from lib.db import db
from models.content import MediaOut
from routers.admin import require_admin

router = APIRouter()
MAX_BYTES = 3 * 1024 * 1024
MAX_SIDE = 600


@router.post("/admin/media", response_model=MediaOut)
async def upload_media(file: UploadFile = File(...), _: str = Depends(require_admin)):
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 3 MB or smaller")
    try:  # re-encode: only real raster images get through (no SVG / HTML), metadata stripped
        im = Image.open(io.BytesIO(raw))
        im.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=422, detail="Upload a PNG, JPG, WEBP or GIF image")
    im = im.convert("RGBA")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    im.save(out, format="PNG", optimize=True)
    media_id = uuid.uuid4().hex
    await db.media.insert_one({"id": media_id, "content_type": "image/png", "data": Binary(out.getvalue()), "name": (file.filename or "")[:120],
                               "width": im.width, "height": im.height, "created_at": datetime.now(timezone.utc)})
    return MediaOut(id=media_id, url=f"/api/media/{media_id}", width=im.width, height=im.height)


@router.get("/media/{media_id}")
async def get_media(media_id: str):
    doc = await db.media.find_one({"id": media_id}, {"_id": 0, "data": 1, "content_type": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=bytes(doc["data"]), media_type=doc["content_type"], headers={"Cache-Control": "public, max-age=31536000, immutable"})
