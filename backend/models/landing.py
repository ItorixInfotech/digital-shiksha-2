from typing import List, Optional

from pydantic import BaseModel, Field

from models.content import College, FaqItem, SeoMeta


class LandingOverrideIn(BaseModel):
    intro: str = Field(default="", max_length=100000)  # editor HTML
    faqs: List[FaqItem] = []
    seo: SeoMeta = Field(default_factory=SeoMeta)


class LandingSummary(BaseModel):
    slug: str
    stream: str
    city: str
    label: str  # "Engineering Colleges in Pune"
    count: int
    customised: bool = False
    default_title: str
    default_description: str
    override: Optional[LandingOverrideIn] = None


class LandingStats(BaseModel):
    count: int
    fees_min: int
    fees_max: int
    avg_fees: int
    avg_package: float
    top_package: float
    exams: List[str]


class LandingLink(BaseModel):
    slug: str
    label: str
    count: int


class LandingCutoff(BaseModel):
    college: str
    slug: str = ""  # college page on this site, if any
    branch: str
    closing_rank: int


class LandingPage(LandingSummary):
    year: int
    h1: str
    intro: str
    faqs: List[FaqItem]
    seo: SeoMeta
    stats: LandingStats
    colleges: List[College]
    same_city: List[LandingLink]
    same_stream: List[LandingLink]
    # Karnataka engineering pages: official KCET closing ranks (best Computer Science seat per college, else best branch)
    cutoff_table: List[LandingCutoff] = []
    cutoff_source: str = ""
    predictor_exam: str = ""
