from typing import List, Optional

from pydantic import BaseModel, Field


class PageSeoIn(BaseModel):
    key: str
    meta_title: str = Field(default="", max_length=120)
    meta_description: str = Field(default="", max_length=320)
    og_image: str = ""
    noindex: bool = False


class PageSeo(PageSeoIn):
    label: str
    path: str
    default_title: str
    default_description: str


class SeoPages(BaseModel):
    year: int
    pages: List[PageSeo]


class SeoPagesIn(BaseModel):
    pages: List[PageSeoIn]


class KeywordFillItem(BaseModel):
    kind: str
    slug: str
    name: str
    keyword: str


class KeywordFillResult(BaseModel):
    dry_run: bool
    without_keyword: int
    will_fill: int
    skipped: int
    newly_green: int
    items: List[KeywordFillItem]


class SeoReportItem(BaseModel):
    kind: str
    slug: str
    name: str
    score: int
    level: str
    fixes: List[str]
    url: str


class SeoReportKind(BaseModel):
    kind: str
    label: str
    green: int
    amber: int
    red: int


class SeoReportSummary(BaseModel):
    baseline: bool
    since: str
    total: int
    needs_fix: int
    kinds: List[SeoReportKind]
    turned_green: List[SeoReportItem]
    top_fixes: List[SeoReportItem]


# ---- Page Manager: per-URL SEO + schema overrides (any page, mirrored in frontend/src/lib/types.ts) ----
SCHEMA_TYPES = ["Organization", "LocalBusiness", "EducationalOrganization", "CollegeOrUniversity", "WebPage", "Article", "NewsArticle",
                "BreadcrumbList", "FAQPage", "Course", "Event", "Product", "HowTo", "WebSite"]


class SchemaBlock(BaseModel):
    type: str  # schema.org @type of the block (one of SCHEMA_TYPES)
    json_text: str = Field(max_length=20000)  # the JSON-LD object as text
    enabled: bool = True


class PageOverrideIn(BaseModel):
    path: str = Field(min_length=1, max_length=300)  # e.g. "/", "/colleges/coep-pune"
    h1: str = Field(default="", max_length=120)
    meta_title: str = Field(default="", max_length=70)
    meta_description: str = Field(default="", max_length=170)
    keywords: List[str] = []
    canonical_url: str = Field(default="", max_length=300)
    og_image: str = Field(default="", max_length=500)
    noindex: bool = False
    schemas: List[SchemaBlock] = []
    replace_auto_schema: bool = True  # custom block of a type replaces the auto-generated block of the same type (no duplicates)


class PageOverride(PageOverrideIn):
    updated_at: str = ""


class SitePage(BaseModel):
    path: str
    label: str
    kind: str  # static | landing | colleges | courses | exams | articles
    default_title: str = ""
    has_override: bool = False
    override_fields: List[str] = []


class SchemaValidateIn(BaseModel):
    type: str
    json_text: str


class SchemaValidateOut(BaseModel):
    valid: bool
    errors: List[str]
    warnings: List[str]
    formatted: str = ""


class PageOverrideSaveOut(BaseModel):
    page: PageOverride
    warnings: List[str]


# ---- Site-wide schema defaults: Organization + LocalBusiness JSON-LD on every page (mirrored in frontend/src/lib/types.ts) ----
class SiteSchema(BaseModel):
    apply_organization: bool = True
    apply_local_business: bool = True
    org_type: str = "EducationalOrganization"  # Organization | EducationalOrganization
    name: str = Field(default="Digital Shiksha", min_length=1, max_length=120)
    legal_name: str = Field(default="", max_length=160)
    description: str = Field(default="", max_length=400)
    logo: str = Field(default="https://www.digitalshiksha.in/logo.png", max_length=500)
    phone: str = Field(default="+91-8149689468", max_length=40)
    email: str = Field(default="enquiry@digitalshiksha.in", max_length=120)
    street_address: str = Field(default="SAUDAMINI COMMERCIAL COMPLEX, C1 - 203, Paud Road, Right Bhusari Colony, Kothrud", max_length=200)
    locality: str = Field(default="Pune", max_length=80)
    region: str = Field(default="Maharashtra", max_length=80)
    postal_code: str = Field(default="411038", max_length=12)
    country: str = Field(default="IN", max_length=2)
    latitude: Optional[float] = 18.5105442  # Google Maps pin of the Kothrud office
    longitude: Optional[float] = 73.7903393
    opening_hours: List[str] = ["Mo-Su 09:00-20:00"]  # schema.org openingHours format
    price_range: str = Field(default="", max_length=20)
    map_url: str = Field(default="https://www.google.com/maps/place/?cid=10762443031543330436", max_length=600)  # Google Maps listing (hasMap)
    facebook: str = Field(default="https://www.facebook.com/DigitalShikshaOfficial", max_length=300)
    instagram: str = Field(default="https://www.instagram.com/digitalshikshaoffical/", max_length=300)
    youtube: str = Field(default="", max_length=300)
    linkedin: str = Field(default="", max_length=300)
    twitter: str = Field(default="", max_length=300)
    updated_at: str = ""


class SiteSchemaSaveOut(BaseModel):
    site: SiteSchema
    warnings: List[str]


# ---- Bulk title fixer ----
class TitleAuditRow(BaseModel):
    path: str
    label: str
    kind: str
    title: str  # what Google sees now (before automatic cut-off)
    description: str
    title_custom: str = ""  # Page Manager override (empty = automatic)
    description_custom: str = ""
    issues: List[str]  # title_missing | title_long | title_short | title_duplicate | desc_missing | desc_long | desc_short


class BulkSeoItem(BaseModel):
    path: str = Field(min_length=1, max_length=300)
    meta_title: str = Field(default="", max_length=70)
    meta_description: str = Field(default="", max_length=170)


class BulkSeoIn(BaseModel):
    items: List[BulkSeoItem] = Field(max_length=500)


class BulkSeoOut(BaseModel):
    saved: int
