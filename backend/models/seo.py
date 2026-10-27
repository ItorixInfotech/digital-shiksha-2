from typing import List

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
