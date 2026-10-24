"""On-page SEO: static-page meta (admin-editable), sitemap.xml, robots.txt."""
import os
from datetime import datetime, timezone
from html import escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse, Response

from lib.dates import today_iso
from lib.year_rollover import ADMISSION_YEAR, EXAM_YEAR
from lib.db import db
from models.seo import PageSeo, SeoPages, SeoPagesIn
from routers.admin import require_admin
from routers.landing import list_landing

router = APIRouter()
KEY = "seo_pages"

STATIC_PAGES = [
    ("home", "Home", "/", "Digital Shiksha: Colleges, Courses, Exams & Counselling {y}",
     "Explore top colleges, courses and entrance exams in India, compare colleges, predict your college and book free admission counselling in Pune & Mumbai. Call +91 8149 68 9468."),
    ("colleges", "Colleges list", "/colleges", "Top Colleges in India {y}: Fees, Cutoff, Placements, Ranking | Digital Shiksha",
     "Find the best engineering, medical, management, law and other colleges in India with fees, NIRF ranking, cutoffs and placements. Filter by city, stream and budget."),
    ("courses", "Courses", "/courses", "Courses After 12th & Graduation {y}: Fees, Eligibility, Scope | Digital Shiksha",
     "Browse UG, PG, diploma and doctorate courses in India — duration, fees, eligibility, entrance exams, specialisations and career scope."),
    ("exams", "Exams", "/exams", "Entrance Exams {y}: Dates, Eligibility, Syllabus | Digital Shiksha",
     "All major Indian entrance exams — JEE Main, NEET UG, MHT CET, CAT, CLAT and more. Exam dates, application deadlines, eligibility and syllabus."),
    ("news", "News & Articles", "/news", "Admission News & Exam Updates {y} | Digital Shiksha",
     "Latest admission news, CAP round guides, exam updates and career articles from Digital Shiksha's counselling experts."),
    ("predictor", "College Predictor", "/predictor", "College Predictor: MHT CET, JEE Main, NEET & Pharmacy | Digital Shiksha",
     "Enter your MHT CET, JEE or NEET score and category to see colleges in Pune, Mumbai and across India you can get. Download your free PDF report."),
    ("compare", "Compare Colleges", "/compare", "Compare Colleges Side by Side: Fees, Placements, Ranking | Digital Shiksha",
     "Compare up to 3 colleges side by side on fees, NIRF rank, placements, courses and exams accepted to choose the right college."),
    ("consultation", "Free Counselling", "/consultation", "Free Admission Counselling in Pune & Mumbai | Digital Shiksha",
     "Book free one-to-one admission counselling with Digital Shiksha experts in Pune. Call or WhatsApp +91 8149 68 9468."),
]


def _year() -> int:
    return max(ADMISSION_YEAR, int(today_iso("Asia/Kolkata")[:4]))  # admission season, not calendar year


async def _pages() -> SeoPages:
    y = _year()
    saved = (await db.settings.find_one({"key": KEY}, {"_id": 0}) or {}).get("pages", {})
    pages = [PageSeo(key=k, label=label, path=path, default_title=t.format(y=EXAM_YEAR if k == "exams" else y), default_description=d,
                     **{f: saved.get(k, {}).get(f, PageSeo.model_fields[f].default) for f in ("meta_title", "meta_description", "og_image", "noindex")})
             for k, label, path, t, d in STATIC_PAGES]
    return SeoPages(year=y, pages=pages)


@router.get("/seo/pages", response_model=SeoPages)
async def get_pages():
    return await _pages()


@router.put("/admin/seo/pages", response_model=SeoPages)
async def save_pages(body: SeoPagesIn, _: str = Depends(require_admin)):
    valid = {p[0] for p in STATIC_PAGES}
    data = {p.key: p.model_dump(exclude={"key"}) for p in body.pages if p.key in valid}
    await db.settings.update_one({"key": KEY}, {"$set": {"key": KEY, "pages": data}}, upsert=True)
    return await _pages()


# Main public domain: sitemap/robots on ANY production host (e.g. digitalshikshaonline.com) list www.digitalshiksha.in URLs.
CANONICAL_SITE = os.environ.get("CANONICAL_SITE_URL", "https://www.digitalshiksha.in").rstrip("/")
_PREVIEW_HOSTS = ("localhost", "127.0.0.1")
_PREVIEW_SUFFIXES = (".emergentagent.com", ".emergent.host")


def _base(request: Request) -> str:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(",")[0].strip()
    name = host.split(":")[0]
    if not host or name in _PREVIEW_HOSTS:
        return os.environ.get("PUBLIC_SITE_URL", "").rstrip("/") or str(request.base_url).rstrip("/")
    if name.endswith(_PREVIEW_SUFFIXES):  # preview links keep their own host
        return f"{request.headers.get('x-forwarded-proto', 'https').split(',')[0]}://{host}"
    return CANONICAL_SITE


def _lastmod(d: dict) -> str:
    v = d.get("updated_at") or d.get("published_at") or d.get("created_at")
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    return str(v)[:10] if isinstance(v, str) and len(v) >= 10 else ""


# (path prefix or exact) -> priority; detail pages default 0.6
_PRIORITY = {"/": "1.0", "/colleges": "0.9", "/predictor": "0.9", "/courses": "0.8", "/exams": "0.8", "/news": "0.7", "/compare": "0.5", "/consultation": "0.6"}


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    """All indexable public pages: static pages, colleges, courses, exams, news, city landing pages (noindex / off-site canonicals skipped)."""
    base = _base(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls: dict[str, tuple[str, str, str]] = {}  # path -> (changefreq, priority, lastmod)
    for p in (await _pages()).pages:
        if not p.noindex:
            urls[p.path] = ("daily" if p.key in ("home", "news") else "weekly", _PRIORITY.get(p.path, "0.6"), today)
    for coll, prefix, freq, prio in (("colleges", "/colleges/", "weekly", "0.8"), ("courses", "/courses/", "monthly", "0.6"),
                                     ("exams", "/exams/", "weekly", "0.7"), ("articles", "/news/", "monthly", "0.6")):
        async for d in db[coll].find({"seo.noindex": {"$ne": True}},
                                     {"_id": 0, "slug": 1, "seo.canonical_url": 1, "updated_at": 1, "published_at": 1, "created_at": 1}):
            canon = (d.get("seo") or {}).get("canonical_url") or ""
            if canon and not canon.startswith(base):
                continue  # canonical points elsewhere → don't list this duplicate
            urls.setdefault(canon[len(base):] if canon else f"{prefix}{d['slug']}", (freq, prio, _lastmod(d)))
    for lp in await list_landing():
        if not (lp.override and lp.override.seo.noindex):
            urls.setdefault(f"/{lp.slug}", ("weekly", "0.7", ""))
    body = "".join(
        f"<url><loc>{escape(base + path)}</loc>{f'<lastmod>{lm}</lastmod>' if lm else ''}<changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
        for path, (freq, prio, lm) in urls.items())
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots(request: Request):
    base = _base(request)
    return "\n".join([
        "# Digital Shiksha — India higher-education portal",
        "User-agent: *",
        "Allow: /",
        "Allow: /api/sitemap.xml",
        "Disallow: /admin",          # admin panel, login and password reset
        "Disallow: /api/",           # JSON API, PDFs and receipts are not pages
        "Disallow: /*?*razorpay_payment_id=",  # payment return links
        "Disallow: /compare?",       # shareable comparison links (endless combinations)
        "Disallow: /predictor?",     # personal predictor results
        "Disallow: /colleges?",      # filter / search combinations
        "Disallow: /*?q=",
        "",
        f"Sitemap: {base}/sitemap.xml",
        f"Sitemap: {base}/api/sitemap.xml",
        "",
    ])
