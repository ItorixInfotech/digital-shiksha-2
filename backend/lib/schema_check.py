"""Validation for admin-entered JSON-LD (schema.org) blocks and page SEO overrides — catches the common mistakes before publishing."""
import json
import re

from models.seo import SCHEMA_TYPES, PageOverrideIn, SchemaBlock

# Required (errors) and recommended (warnings) properties per type, following Google's rich-result guidelines.
REQUIRED = {
    "Organization": ["name", "url"], "EducationalOrganization": ["name", "url"], "CollegeOrUniversity": ["name"],
    "LocalBusiness": ["name", "address"], "WebPage": ["name"], "WebSite": ["name", "url"],
    "Article": ["headline"], "NewsArticle": ["headline"], "BreadcrumbList": ["itemListElement"], "FAQPage": ["mainEntity"],
    "Course": ["name", "description"], "Event": ["name", "startDate"], "Product": ["name"], "HowTo": ["name", "step"],
}
RECOMMENDED = {
    "Organization": ["logo", "sameAs"], "LocalBusiness": ["telephone", "url", "openingHours", "geo"], "WebPage": ["url", "description"],
    "Article": ["datePublished", "author", "image"], "NewsArticle": ["datePublished", "author", "image"], "Course": ["provider"],
    "Event": ["location"], "CollegeOrUniversity": ["url", "address"],
}


def validate_schema(type_: str, text: str) -> tuple[list[str], list[str], str]:
    errors: list[str] = []
    warnings: list[str] = []
    if type_ not in SCHEMA_TYPES:
        return [f"Unsupported schema type '{type_}'. Use one of: {', '.join(SCHEMA_TYPES)}"], [], ""
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        return [f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"], [], ""
    if not isinstance(data, dict):
        return ["The schema must be one JSON object { … } (add one block per type)."], [], ""
    ctx = str(data.get("@context", ""))
    if not re.match(r"^https?://schema\.org/?$", ctx):
        errors.append('"@context" must be "https://schema.org"')
    if data.get("@type") != type_:
        errors.append(f'"@type" must be "{type_}" (found {json.dumps(data.get("@type"))})')
    for k in REQUIRED.get(type_, []):
        if data.get(k) in (None, "", [], {}):
            errors.append(f'Missing required property "{k}" for {type_}')
    for k in RECOMMENDED.get(type_, []):
        if data.get(k) in (None, "", [], {}):
            warnings.append(f'Recommended property "{k}" is missing')
    if type_ == "FAQPage" and isinstance(data.get("mainEntity"), list):
        for i, q in enumerate(data["mainEntity"], 1):
            if not isinstance(q, dict) or q.get("@type") != "Question" or not q.get("name") or not (q.get("acceptedAnswer") or {}).get("text"):
                errors.append(f"FAQ item {i} needs @type Question, name and acceptedAnswer.text")
    if type_ == "BreadcrumbList" and isinstance(data.get("itemListElement"), list):
        for i, it in enumerate(data["itemListElement"], 1):
            if not isinstance(it, dict) or it.get("position") != i or not it.get("name"):
                errors.append(f"Breadcrumb item {i} needs position {i} and name")
    if type_ == "LocalBusiness" and isinstance(data.get("address"), dict) and not data["address"].get("addressLocality"):
        warnings.append('address.addressLocality (city) is recommended')
    for k in ("url", "logo", "image"):
        v = data.get(k)
        if isinstance(v, str) and v and not v.startswith(("https://", "http://")):
            errors.append(f'"{k}" must be a full URL starting with https://')
    if "<script" in text.lower():
        errors.append("Do not include <script> tags — paste only the JSON object")
    return errors, warnings, json.dumps(data, indent=2, ensure_ascii=False)


def validate_override(p: PageOverrideIn) -> tuple[list[str], list[str]]:
    """Errors block the save; warnings are shown but allowed."""
    errors: list[str] = []
    warnings: list[str] = []
    if not p.path.startswith("/") or " " in p.path or "?" in p.path or "#" in p.path:
        errors.append('Page path must start with "/" and contain no spaces, ? or #')
    if p.meta_title and len(p.meta_title) < 15:
        warnings.append("Meta title is very short (aim for 30–60 characters)")
    if len(p.meta_title) > 60:
        warnings.append("Meta title is over 60 characters and may be cut off in Google")
    if p.meta_description and not 70 <= len(p.meta_description) <= 160:
        warnings.append("Meta description works best at 70–160 characters")
    if p.canonical_url and not (p.canonical_url.startswith("/") or re.match(r"^https://(www\.)?digitalshiksha\.in(/|$)", p.canonical_url)):
        errors.append("Canonical URL must be a path (/page) or a https://www.digitalshiksha.in URL")
    if p.og_image and not p.og_image.startswith(("https://", "/")):
        errors.append("Share image must be a full https:// URL or a /path")
    if p.noindex and p.canonical_url:
        warnings.append("A noindex page should not also set a canonical URL")
    seen: set[str] = set()
    for i, b in enumerate(p.schemas, 1):
        e, w, _ = validate_schema(b.type, b.json_text)
        errors += [f"Schema {i} ({b.type}): {x}" for x in e]
        warnings += [f"Schema {i} ({b.type}): {x}" for x in w]
        if b.enabled and b.type in seen:
            errors.append(f"Schema {i}: a second enabled {b.type} block on the same page creates duplicate markup")
        seen.add(b.type) if b.enabled else None
    return errors, warnings


def formatted_blocks(blocks: list[SchemaBlock]) -> list[SchemaBlock]:
    return [SchemaBlock(type=b.type, enabled=b.enabled, json_text=validate_schema(b.type, b.json_text)[2] or b.json_text) for b in blocks]
