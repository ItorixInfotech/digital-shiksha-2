"""Pydantic models for Digital Shiksha content + leads. Mirrored in frontend/src/lib/types.ts."""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, EmailStr


def _id() -> str:
    return str(uuid.uuid4())


class CollegeCourse(BaseModel):
    name: str
    duration: str = ""
    fees: str = ""
    eligibility: str = ""
    seats: Optional[int] = None


class CutoffRow(BaseModel):
    exam: str
    branch: str
    cutoff: str


class CollegeIn(BaseModel):
    slug: str
    name: str
    short_name: str = ""
    city: str
    state: str
    type: str = "Private"
    established: Optional[int] = None
    streams: List[str] = []
    nirf_rank: Optional[int] = None
    rating: float = 4.0
    fees_min: int = 0
    fees_max: int = 0
    avg_package: float = 0
    highest_package: float = 0
    placement_rate: int = 0
    approvals: List[str] = []
    exams_accepted: List[str] = []
    image: str = ""
    overview: str = ""
    admission: str = ""
    courses: List[CollegeCourse] = []
    cutoffs: List[CutoffRow] = []
    top_recruiters: List[str] = []
    facilities: List[str] = []
    featured: bool = False


class College(CollegeIn):
    id: str = Field(default_factory=_id)


class CourseIn(BaseModel):
    slug: str
    name: str
    full_name: str = ""
    stream: str
    level: str = "UG"
    duration: str = ""
    avg_fees: str = ""
    avg_salary: str = ""
    eligibility: str = ""
    overview: str = ""
    entrance_exams: List[str] = []
    specializations: List[str] = []
    careers: List[str] = []
    popular: bool = False


class Course(CourseIn):
    id: str = Field(default_factory=_id)


class ExamIn(BaseModel):
    slug: str
    name: str
    full_name: str = ""
    stream: str
    level: str = "National"
    conducting_body: str = ""
    exam_date: str = ""
    application_deadline: str = ""
    mode: str = "Online"
    eligibility: str = ""
    overview: str = ""
    syllabus: List[str] = []
    website: str = ""


class Exam(ExamIn):
    id: str = Field(default_factory=_id)


class ArticleIn(BaseModel):
    slug: str
    title: str
    category: str = "Admission"
    excerpt: str = ""
    content: str = ""
    author: str = "Digital Shiksha Team"
    image: str = ""
    published_at: str = ""
    tags: List[str] = []


class Article(ArticleIn):
    id: str = Field(default_factory=_id)


LeadStatus = Literal["New", "Contacted", "In-Progress", "Converted"]


class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    email: Optional[EmailStr] = None
    city: str = ""
    course_interest: str = ""
    college: str = ""
    budget: str = ""
    message: str = ""
    source: str = "website"


class Lead(LeadIn):
    id: str = Field(default_factory=_id)
    status: LeadStatus = "New"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadStatusUpdate(BaseModel):
    status: LeadStatus


class SearchHit(BaseModel):
    kind: Literal["college", "course", "exam"]
    slug: str
    title: str
    subtitle: str


class FacetCount(BaseModel):
    name: str
    count: int


class Meta(BaseModel):
    streams: List[FacetCount]
    cities: List[FacetCount]
    states: List[FacetCount]
    types: List[FacetCount]
    totals: dict


class LoginIn(BaseModel):
    username: str
    password: str


class AdminMe(BaseModel):
    username: str


class AdminStats(BaseModel):
    leads: int
    new_leads: int
    colleges: int
    courses: int
    exams: int
    articles: int
