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
