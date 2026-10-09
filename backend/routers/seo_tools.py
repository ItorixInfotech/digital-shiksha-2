"""Bulk focus keywords + weekly SEO report email (manual + Monday 9 AM IST cron)."""
import logging
import os
from datetime import datetime, timezone
from html import escape

from fastapi import APIRouter, BackgroundTasks, Depends, Request

from lib import seo_score as ss
from lib.cron import accept_cron
from lib.dates import today_iso
from lib.db import db
from lib.email import send_email
from models.seo import KeywordFillItem, KeywordFillResult, SeoReportItem, SeoReportKind, SeoReportSummary
from routers.admin import require_admin
from routers.landing import list_landing

router = APIRouter()
logger = logging.getLogger(__name__)
KINDS = ("colleges", "courses", "exams", "articles")
LABEL = {"colleges": "College", "courses": "Course", "exams": "Exam", "articles": "Article", "landing": "City page"}
SNAPSHOT = "seo_snapshot"


def _year() -> int:
    return int(today_iso("Asia/Kolkata")[:4])


@router.post("/admin/seo/keywords", response_model=KeywordFillResult)
async def fill_keywords(dry_run: bool = True, _: str = Depends(require_admin)):
    year = _year()
    items, skipped, without, greens = [], 0, 0, 0
    for kind in KINDS:
        async for r in db[kind].find({"$or": [{"seo.keywords": {"$exists": False}}, {"seo.keywords": {"$size": 0}}]}, {"_id": 0}):
            without += 1
            kw = ss.suggest_keyword(kind, r, year)
            if not kw:
                skipped += 1
                continue
            before = ss.entity_score(kind, r, year)["level"]
            after_doc = {**r, "seo": {**(r.get("seo") or {}), "keywords": [kw]}}
            after = ss.entity_score(kind, after_doc, year)["level"]
            greens += before != "green" and after == "green"
            items.append(KeywordFillItem(kind=kind, slug=r["slug"], name=r.get("name") or r.get("title") or r["slug"], keyword=kw))
            if not dry_run:
                seo = {**_empty_seo(), **(r.get("seo") or {}), "keywords": [kw]}
                await db[kind].update_one({"slug": r["slug"]}, {"$set": {"seo": seo}})
    return KeywordFillResult(dry_run=dry_run, without_keyword=without, will_fill=len(items), skipped=skipped, newly_green=greens, items=items[:300])


def _empty_seo() -> dict:
    return {"meta_title": "", "meta_description": "", "keywords": [], "canonical_url": "", "og_image": "", "noindex": False}


async def build_report() -> tuple[SeoReportSummary, dict]:
    year = _year()
    rows: list[tuple[str, str, str, dict]] = []  # kind, slug, name, score
    for kind in KINDS:
        async for r in db[kind].find({}, {"_id": 0}):
            rows.append((kind, r["slug"], r.get("name") or r.get("title") or r["slug"], ss.entity_score(kind, r, year)))
    for lp in await list_landing():
        rows.append(("landing", lp.slug, lp.label, ss.landing_score(lp)))
    snap = await db.settings.find_one({"key": SNAPSHOT}, {"_id": 0}) or {}
    prev = snap.get("levels") or {}
    levels = {f"{k}:{s}": sc["level"] for k, s, _, sc in rows}
    base = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
    item = lambda k, s, n, sc: SeoReportItem(kind=k, slug=s, name=n, score=sc["score"], level=sc["level"],  # noqa: E731
                                             fixes=[ss.SHORT_FIX[f] for f in sc["failing"]], url=f"{base}{ss.PATHS[k]}{s}")
    green_now = [item(*r) for r in rows if r[3]["level"] == "green" and prev and prev.get(f"{r[0]}:{r[1]}") not in (None, "green")]
    todo = sorted((r for r in rows if r[3]["level"] != "green"), key=lambda r: (r[3]["effort"], -r[3]["score"], r[2]))
    kinds = [SeoReportKind(kind=k, label=LABEL[k], green=sum(1 for r in rows if r[0] == k and r[3]["level"] == "green"),
                           amber=sum(1 for r in rows if r[0] == k and r[3]["level"] == "amber"), red=sum(1 for r in rows if r[0] == k and r[3]["level"] == "red"))
             for k in (*KINDS, "landing")]
    at = snap.get("at")
    return SeoReportSummary(baseline=not prev, since=at.strftime("%d %b %Y") if at else "", total=len(rows), needs_fix=len(todo), kinds=kinds,
                            turned_green=green_now[:30], top_fixes=[item(*r) for r in todo[:10]]), levels


def report_html(rep: SeoReportSummary) -> str:
    base = os.environ.get("PUBLIC_SITE_URL", "").rstrip("/")
    td = 'style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a"'
    kind_rows = "".join(f"<tr><td {td}>{escape(k.label)}s</td><td {td}><b style='color:#16a34a'>{k.green}</b></td><td {td}><b style='color:#d97706'>{k.amber}</b></td>"
                        f"<td {td}><b style='color:#dc2626'>{k.red}</b></td></tr>" for k in rep.kinds)
    link = lambda i: f'<a href="{escape(i.url)}" style="color:#1e3a8a">{escape(i.name)}</a>' if i.url.startswith("https://") else escape(i.name)  # noqa: E731
    fixes = "".join(f"<tr><td {td}>{n}. {link(i)}<br><span style='color:#64748b;font-size:12px'>{escape(LABEL[i.kind])} · score {i.score}</span></td>"
                    f"<td {td}>{escape(', '.join(i.fixes))}</td></tr>" for n, i in enumerate(rep.top_fixes, 1))
    if rep.baseline:
        green = "<p style='font-size:14px;color:#334155'>This is the first report — today's scores are saved as the baseline. Next Monday you'll see which pages turned green.</p>"
    elif rep.turned_green:
        green = "<ul style='padding-left:18px;font-size:14px'>" + "".join(f"<li style='padding:2px 0'>{link(i)} <span style='color:#64748b'>({escape(LABEL[i.kind])})</span></li>" for i in rep.turned_green) + "</ul>"
    else:
        green = "<p style='font-size:14px;color:#334155'>No pages turned green this week — the quick fixes below are a good place to start.</p>"
    admin = f'<p style="margin-top:20px"><a href="{base}/admin" style="background:#dc2626;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Open SEO Fix List</a></p>' if base.startswith("https://") else ""
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px">'
        '<div style="background:#0a2540;padding:18px 22px;border-radius:12px 12px 0 0;color:#fff;font-size:18px;font-weight:bold">'
        '<span style="color:#f87171">Digital</span> Shiksha <span style="font-size:13px;color:#cbd5e1;font-weight:normal">Weekly SEO report</span></div>'
        f'<div style="padding:22px;color:#0f172a"><p style="font-size:15px"><b>{rep.needs_fix}</b> of {rep.total} pages still need SEO work.</p>'
        f'<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px"><tr><td {td}><b>Type</b></td><td {td}><b>Green</b></td><td {td}><b>Amber</b></td><td {td}><b>Red</b></td></tr>{kind_rows}</table>'
        f'<h3 style="margin:22px 0 6px;font-size:16px">Turned green{f" since {escape(rep.since)}" if rep.since and not rep.baseline else ""} ({len(rep.turned_green)})</h3>{green}'
        f'<h3 style="margin:22px 0 6px;font-size:16px">Top 10 quickest fixes</h3><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px">{fixes or f"<tr><td {td}>Everything is green!</td></tr>"}</table>'
        f'{admin}</div><div style="padding:14px 22px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">Automated weekly report from the Digital Shiksha admin panel.</div></div>'
    )


async def send_report(rep: SeoReportSummary, levels: dict, update_snapshot: bool) -> None:
    """Background task: never raises."""
    to = os.environ.get("SEO_REPORT_EMAIL") or os.environ.get("LEAD_ALERT_EMAIL")
    try:
        if to:
            await send_email(to=to, subject=f"Weekly SEO report: {rep.needs_fix} pages to fix, {len(rep.turned_green)} turned green", html=report_html(rep))
        if update_snapshot or rep.baseline:
            await db.settings.update_one({"key": SNAPSHOT}, {"$set": {"key": SNAPSHOT, "levels": levels, "at": datetime.now(timezone.utc)}}, upsert=True)
        await db.settings.update_one({"key": "seo_report_last"}, {"$set": {"key": "seo_report_last", "at": datetime.now(timezone.utc), "to": to or ""}}, upsert=True)
    except Exception as exc:  # noqa: BLE001
        logger.error("Weekly SEO report failed: %s", exc)


@router.post("/admin/seo/report/send", response_model=SeoReportSummary)
async def send_now(background: BackgroundTasks, _: str = Depends(require_admin)):
    rep, levels = await build_report()
    background.add_task(send_report, rep, levels, False)  # manual = week-so-far; doesn't move Monday's baseline
    return rep


@router.post("/cron/weekly-seo-report", status_code=202)
async def cron_weekly_report(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    early = await accept_cron(request, "weekly-seo-report")
    if early is not None:
        return early

    async def job():
        rep, levels = await build_report()
        await send_report(rep, levels, True)

    background.add_task(job)
    return {"ok": True}
