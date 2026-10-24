"""Claude-powered features: admin content + SEO drafting, student admission chat (SSE), paid predictor advice."""
import hashlib
import json
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from lib import ai
from lib.db import db
from models.ai import (AdviceIn, AdviceOut, AIContentIn, AIContentOut, AISeoIn, AISeoOut, AIStatus, ChatHistory, ChatIn,
                       ChatMessage)
from routers.admin import require_admin

router = APIRouter()

TARGETS = {"colleges": ["overview", "admission"], "courses": ["overview"], "exams": ["overview"], "articles": ["excerpt", "content"]}
FAQ_KINDS = {"colleges", "exams"}
BRAND = ("You write for Digital Shiksha, an India-only higher-education admission counselling portal (Pune & Mumbai). "
         "Audience: Indian students and parents. Use clear, factual Indian English; use ₹ and Indian terms (CAP rounds, NIRF, "
         "state quota). Never invent exact numbers (fees, ranks, cut-offs, dates) that are not in the given facts — write them generally instead.")


def _err(exc: ai.AIError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=exc.detail)


def _facts(fields: dict) -> str:
    return "\n".join(f"- {k}: {v}" for k, v in fields.items() if v not in (None, "", False) and k not in ("slug", "seo", "image"))[:4000]


@router.get("/admin/ai/status", response_model=AIStatus)
async def ai_status(_: str = Depends(require_admin)):
    return AIStatus(configured=ai.configured(), model=ai.MODEL[1])


@router.post("/admin/ai/content", response_model=AIContentOut)
async def ai_content(body: AIContentIn, _: str = Depends(require_admin)):
    targets = TARGETS[body.kind]
    faq = body.kind in FAQ_KINDS
    spec = {k: "string" for k in targets} | ({"faqs": [{"question": "string", "answer": "string"}]} if faq else {})
    prompt = (f"Draft website content for this {body.kind[:-1]}.\nFacts:\n{_facts(body.fields)}\n"
              + (f"Extra instructions: {body.instructions}\n" if body.instructions else "")
              + "Lengths: overview 180-260 words in 2-3 paragraphs separated by a blank line; admission 80-140 words; "
                "excerpt max 35 words; content 350-500 words in paragraphs separated by blank lines"
              + ("; 5 FAQs students really ask, answers 30-60 words" if faq else "")
              + f".\nJSON shape: {json.dumps(spec)}")
    try:
        out = await ai.complete_json(BRAND, prompt, max_tokens=2500)
    except ai.AIError as exc:
        raise _err(exc)
    faqs = [f for f in out.get("faqs", []) if isinstance(f, dict) and f.get("question") and f.get("answer")][:8] if faq else []
    return AIContentOut(text={k: str(out.get(k, "")).strip() for k in targets if out.get(k)}, faqs=faqs)


@router.post("/admin/ai/seo", response_model=AISeoOut)
async def ai_seo(body: AISeoIn, _: str = Depends(require_admin)):
    prompt = (f"Write on-page SEO for this {body.kind} page on Digital Shiksha.\nFacts:\n{_facts(body.fields)}\n"
              "Rules: meta_title 50-60 characters, includes the main name and ends with '| Digital Shiksha' if it fits; "
              "meta_description 140-160 characters with a call to action; keywords: 4-6 short search phrases Indian students use, "
              "the first one must appear in both title and description.\n"
              'JSON shape: {"meta_title": "string", "meta_description": "string", "keywords": ["string"]}')
    try:
        out = await ai.complete_json(BRAND, prompt, max_tokens=600)
    except ai.AIError as exc:
        raise _err(exc)
    kws = [str(k).strip() for k in out.get("keywords", []) if str(k).strip()][:8]
    return AISeoOut(meta_title=str(out.get("meta_title", "")).strip()[:120], meta_description=str(out.get("meta_description", "")).strip()[:320], keywords=kws)


# ---- Student admission chat -------------------------------------------------------------------------------
_CTX: dict = {"at": 0.0, "text": ""}


async def _site_context() -> str:
    """Compact catalogue for the system prompt, cached 30 min."""
    if time.time() - _CTX["at"] < 1800 and _CTX["text"]:
        return _CTX["text"]
    cols = [f"{c['name']} ({c.get('city', '')}, {c.get('type', '')}{', NIRF ' + str(c['nirf_rank']) if c.get('nirf_rank') else ''}) /colleges/{c['slug']}"
            async for c in db.colleges.find({}, {"_id": 0, "name": 1, "city": 1, "type": 1, "nirf_rank": 1, "slug": 1}).limit(80)]
    courses = [c["name"] async for c in db.courses.find({}, {"_id": 0, "name": 1}).limit(60)]
    exams = [f"{e['name']}{' (' + e['exam_date'] + ')' if e.get('exam_date') else ''}" async for e in db.exams.find({}, {"_id": 0, "name": 1, "exam_date": 1}).limit(40)]
    _CTX.update(at=time.time(), text=f"COLLEGES: {'; '.join(cols)}\nCOURSES: {', '.join(courses)}\nEXAMS: {', '.join(exams)}")
    return _CTX["text"]


async def _chat_system() -> str:
    return (BRAND + "\nYou are 'Shiksha Assistant', the website's admission chat helper. Answer questions about colleges, courses, "
            "entrance exams, CAP rounds, eligibility and the admission process in India. Keep answers short (under 120 words), "
            "friendly and practical; use bullet points for lists. Link pages as relative paths like /colleges/<slug>, /predictor, /compare, /exams. "
            "For a personal college list, suggest the College Predictor at /predictor. For anything needing a human (fees negotiation, "
            "documents, seat booking), invite them to call/WhatsApp +91 8149 68 9468 or book free counselling. "
            "Do not answer topics unrelated to education/admissions; politely steer back. Never ask for passwords, OTPs or card details.\n"
            f"Site catalogue (use for facts; say so if something isn't listed):\n{await _site_context()}")


@router.get("/chat/{session_id}", response_model=ChatHistory)
async def chat_history(session_id: str):
    rows = await db.chat_messages.find({"session_id": session_id}, {"_id": 0, "role": 1, "content": 1}).sort("created_at", 1).to_list(60)
    return ChatHistory(messages=[ChatMessage(**r) for r in rows])


@router.post("/chat/stream")
async def chat_stream(body: ChatIn, request: Request):
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    if await db.chat_messages.count_documents({"session_id": body.session_id, "role": "user", "created_at": {"$gte": since}}) >= 40:
        raise HTTPException(status_code=429, detail="Daily chat limit reached — call +91 8149 68 9468 for more help")
    prior = await db.chat_messages.find({"session_id": body.session_id}, {"_id": 0, "role": 1, "content": 1}).sort("created_at", -1).to_list(16)
    history = [{"role": r["role"], "content": r["content"]} for r in reversed(prior)]
    system = await _chat_system()
    msg = body.message.strip()
    await db.chat_messages.insert_one({"session_id": body.session_id, "role": "user", "content": msg, "created_at": datetime.now(timezone.utc)})

    async def events():
        parts: list[str] = []
        try:
            async for delta in ai.stream_reply(system, history, msg):
                parts.append(delta)
                yield f"data: {json.dumps({'delta': delta})}\n\n"
            reply = "".join(parts).strip()
            if reply:
                await db.chat_messages.insert_one({"session_id": body.session_id, "role": "assistant", "content": reply,
                                                   "created_at": datetime.now(timezone.utc)})
            yield f"data: {json.dumps({'done': True})}\n\n"
        except ai.AIError as exc:
            yield f"data: {json.dumps({'error': exc.detail})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---- Paid predictor advice ----------------------------------------------------------------------------------
def advice_key(pred: dict) -> str:
    keep = {k: pred.get(k) for k in ("exam", "score", "category", "cities", "ladies", "home_university", "branch_group")}
    return hashlib.sha256(json.dumps(keep, sort_keys=True, default=str).encode()).hexdigest()


async def cached_advice(pred: dict) -> str:
    d = await db.predictor_advice.find_one({"key": advice_key(pred)}, {"_id": 0, "advice": 1})
    return (d or {}).get("advice", "")


@router.post("/predictor/advice", response_model=AdviceOut)
async def predictor_advice(body: AdviceIn, request: Request):
    from routers.predictor import require_unlock, run_prediction  # avoid import cycle
    pred = body.prediction
    await require_unlock(pred, request)
    if hit := await cached_advice(pred.model_dump()):
        return AdviceOut(advice=hit)
    out = await run_prediction(pred)
    top = [f"{r.college_name} – {r.course} ({r.city}, chance {r.chance}, cut-off {r.cutoff})" for r in out.results[:15]]
    counts = {c: sum(r.chance == c for r in out.results) for c in ("High", "Medium", "Reach")}
    prompt = (f"Student: {pred.exam}, {out.metric} {pred.score:g}, category {pred.category}"
              + (f", preferred cities {', '.join(pred.cities)}" if pred.cities else "") + f".\nTotals: {counts} out of {out.total} options.\n"
              "Top matches:\n" + ("\n".join(top) or "none") + "\n"
              "Write a personal advice note (110-160 words, 4-6 short bullet points starting with '• '): how to fill the option form "
              "(mix of dream / target / safe choices from this list), what to watch in CAP rounds, and one next step. "
              "Plain text only. End with: 'This is only a prediction based on previous years' cut-offs — for more details, contact your counsellor.'")
    try:
        advice = await ai.complete_text(BRAND, prompt, max_tokens=500)
    except ai.AIError as exc:
        raise _err(exc)
    await db.predictor_advice.update_one({"key": advice_key(pred.model_dump())},
                                         {"$set": {"advice": advice, "created_at": datetime.now(timezone.utc)}}, upsert=True)
    return AdviceOut(advice=advice)
