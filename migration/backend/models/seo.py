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
