"""On-page SEO: static-page meta (admin-editable), sitemap.xml, robots.txt."""
import os
from html import escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse, Response

from lib.dates import today_iso
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
    ("predictor", "College Predictor", "/predictor", "College Predictor {y}: MHT CET, JEE Main, NEET Rank & Percentile | Digital Shiksha",
     "Enter your MHT CET, JEE or NEET score and category to see colleges in Pune, Mumbai and across India you can get. Download your free PDF report."),
    ("compare", "Compare Colleges", "/compare", "Compare Colleges Side by Side: Fees, Placements, Ranking | Digital Shiksha",
     "Compare up to 3 colleges side by side on fees, NIRF rank, placements, courses and exams accepted to choose the right college."),
    ("consultation", "Free Counselling", "/consultation", "Free Admission Counselling in Pune & Mumbai | Digital Shiksha",
     "Book free one-to-one admission counselling with Digital Shiksha experts in Kothrud, Pune. Call or WhatsApp +91 8149 68 9468."),
]


def _year() -> int:
    return int(today_iso("Asia/Kolkata")[:4])


async def _pages() -> SeoPages:
    y = _year()
    saved = (await db.settings.find_one({"key": KEY}, {"_id": 0}) or {}).get("pages", {})
    pages = [PageSeo(key=k, label=label, path=path, default_title=t.format(y=y), default_description=d,
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


def _base(request: Request) -> str:
    # Self-hosted: the canonical site URL wins (the API may live on api.* or behind a proxy).
    if os.environ.get("PUBLIC_SITE_URL"):
        return os.environ["PUBLIC_SITE_URL"].rstrip("/")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if host and not host.startswith(("localhost", "127.0.0.1")):
        return f"{request.headers.get('x-forwarded-proto', 'https').split(',')[0]}://{host.split(',')[0]}"
    return os.environ.get("PUBLIC_SITE_URL", "").rstrip("/") or str(request.base_url).rstrip("/")


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    base = _base(request)
    urls: list[tuple[str, str]] = [(p.path, "daily" if p.key in ("home", "news") else "weekly") for p in (await _pages()).pages if not p.noindex]
    for coll, prefix in (("colleges", "/colleges/"), ("courses", "/courses/"), ("exams", "/exams/"), ("articles", "/news/")):
        async for d in db[coll].find({"seo.noindex": {"$ne": True}}, {"_id": 0, "slug": 1, "seo.canonical_url": 1}):
            canon = (d.get("seo") or {}).get("canonical_url") or ""
            if canon and not canon.startswith(base):
                continue  # canonical points elsewhere → don't list this duplicate
            urls.append((canon[len(base):] if canon else f"{prefix}{d['slug']}", "weekly"))
    for lp in await list_landing():
        if not (lp.override and lp.override.seo.noindex):
            urls.append((f"/{lp.slug}", "weekly"))
    body = "".join(f"<url><loc>{escape(base + path)}</loc><changefreq>{freq}</changefreq></url>" for path, freq in dict.fromkeys(urls))
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(xml, media_type="application/xml")


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots(request: Request):
    base = _base(request)
    return f"User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: {base}/sitemap.xml\nSitemap: {base}/api/sitemap.xml\n"
