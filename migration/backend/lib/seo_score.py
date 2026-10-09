"""Server-side SEO scoring — a Python mirror of frontend/src/lib/seo.ts (defaultSeo / seoScore / FIX_EFFORT).
Keep the two in sync: the admin UI scores live while typing, this module powers bulk keywords + the weekly email."""
import re

SITE = "Digital Shiksha"
PHONE = "+91 8149 68 9468"
TITLE_MAX, DESC_MAX = 60, 160
FIX_EFFORT = {"index": 1, "keyword": 1, "title": 2, "description": 2, "image": 2, "faqs": 3, "content": 4}
SHORT_FIX = {"index": "Remove noindex", "keyword": "Focus keyword", "title": "Title length", "description": "Description length",
             "image": "Share image", "faqs": "Add FAQs", "content": "300+ chars content"}
PATHS = {"colleges": "/colleges/", "courses": "/courses/", "exams": "/exams/", "articles": "/news/", "landing": "/"}


def _s(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:g}"
    return str(v).strip()


def clip(s: str, n: int) -> str:
    return s if len(s) <= n else re.sub(r"\s+\S*$", "", s[: n - 1]) + "…"


def _first_sentence(s: str) -> str:
    return re.split(r"(?<=\.)\s", _s(s))[0] if _s(s) else ""


def default_seo(kind: str, r: dict, year: int) -> tuple[str, str]:
    if kind == "colleges":
        name, city = _s(r.get("name")), _s(r.get("city"))
        short = _s(r.get("short_name")) or name
        exams = ", ".join([str(e).strip() for e in r.get("exams_accepted") or [] if str(e).strip()][:3])
        parts = [f"{name}{f', {city}' if city else ''}: courses & fees{f', {exams} cutoff' if exams else ''}",
                 f"placements (avg ₹{_s(r.get('avg_package'))} LPA)" if r.get("avg_package") else "placements",
                 f"NIRF rank {_s(r.get('nirf_rank'))}" if r.get("nirf_rank") else "", f"admission {year}"]
        title = f"{short}{f' {city}' if city and city not in short else ''}: Fees, Cutoff, Placements {year} | {SITE}"
        return title, clip(f"{', '.join(p for p in parts if p)}. Free counselling: {PHONE}.", DESC_MAX)
    if kind == "courses":
        name, full = _s(r.get("name")), _s(r.get("full_name"))
        title = f"{name}{f' ({full})' if full and full != name else ''}: Fees, Eligibility, Colleges {year} | {SITE}"
        desc = _first_sentence(r.get("overview")) or (f"{full or name} course details — duration {_s(r.get('duration')) or '-'}, fees {_s(r.get('avg_fees')) or '-'}, "
                                                       "eligibility, entrance exams, top colleges and career scope in India.")
        return title, clip(desc, DESC_MAX)
    if kind == "exams":
        name, full, date = _s(r.get("name")), _s(r.get("full_name")), _s(r.get("exam_date"))
        return (f"{name} {year}: Exam Date, Eligibility, Syllabus, Cutoff | {SITE}",
                clip(f"{full or name} {year}{f' on {date}' if date else ''} — application dates, eligibility, syllabus, pattern, cutoff and colleges accepting {name}.", DESC_MAX))
    return f"{clip(_s(r.get('title')), 48)} | {SITE}", clip(_s(r.get("excerpt")) or _first_sentence(r.get("content")), DESC_MAX)


def effective(kind: str, r: dict, year: int) -> tuple[str, str, dict]:
    seo = r.get("seo") or {}
    t, d = default_seo(kind, r, year)
    return seo.get("meta_title") or t, seo.get("meta_description") or d, seo


def score(*, title: str, description: str, keywords: list, has_image: bool, body_len: int, faq_count, noindex: bool) -> dict:
    kw = (keywords[0] if keywords else "").lower()
    checks = {
        "title": 30 <= len(title) <= TITLE_MAX,
        "description": 70 <= len(description) <= DESC_MAX,
        "keyword": bool(kw) and kw in f"{title} {description}".lower(),
        "image": has_image,
        "content": body_len >= 300,
        **({} if faq_count is None else {"faqs": faq_count > 0}),
        "index": not noindex,
    }
    passed = sum(checks.values())
    pct = round(passed / len(checks) * 100)
    failing = sorted((k for k, ok in checks.items() if not ok), key=lambda k: FIX_EFFORT[k])
    return {"score": pct, "level": "green" if pct >= 80 else "amber" if pct >= 50 else "red", "failing": failing,
            "effort": sum(FIX_EFFORT[k] for k in failing)}


def entity_score(kind: str, r: dict, year: int) -> dict:
    title, desc, seo = effective(kind, r, year)
    return score(title=title, description=desc, keywords=seo.get("keywords") or [], has_image=bool(seo.get("og_image") or _s(r.get("image"))),
                 body_len=len(_s(r.get("content" if kind == "articles" else "overview"))),
                 faq_count=len(r.get("faqs") or []) if kind in ("colleges", "exams") else None, noindex=bool(seo.get("noindex")))


def landing_score(l) -> dict:
    o = l.override
    return score(title=(o and o.seo.meta_title) or l.default_title, description=(o and o.seo.meta_description) or l.default_description,
                 keywords=(o.seo.keywords if o and o.seo.keywords else [l.label]), has_image=True,
                 body_len=len(o.intro) if o and o.intro else 300, faq_count=(len(o.faqs) if o else 0) or 5, noindex=bool(o and o.seo.noindex))


def suggest_keyword(kind: str, r: dict, year: int) -> str:
    """Short, name-based keyword that already appears in the page's effective title or description ('' if none fits)."""
    title, desc, _ = effective(kind, r, year)
    hay = f"{title} {desc}".lower()
    name = _s(r.get("name")) or _s(r.get("title"))
    if kind == "colleges":
        short, city = _s(r.get("short_name")) or name, _s(r.get("city"))
        cands = [f"{short} {city}" if city and city not in short else short, short, name]
    elif kind == "courses":
        cands = [f"{name} course", f"{name} admission", f"{name} fees", name]
    elif kind == "exams":
        cands = [f"{name} {year}", name]
    else:
        words = name.split()
        cands = [*[str(t) for t in r.get("tags") or []], " ".join(words[:4]), " ".join(words[:3])]
    return next((c for c in cands if c.strip() and c.lower() in hay), "")
