"""College predictor models. Mirrored in frontend/src/lib/types.ts."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Literal

from pydantic import BaseModel, Field

Metric = Literal["percentile", "score", "rank"]
Chance = Literal["High", "Medium", "Reach"]
Category = Literal["General", "OBC", "EWS", "SC", "ST"]


class PredictorExam(BaseModel):
    name: str
    metric: Metric
    min: float
    max: float
    label: str
    hint: str
    rank_note: str = ""


class PredictorIn(BaseModel):
    exam: str
    score: float = Field(ge=0)
    category: Category = "General"
    cities: List[str] = []  # e.g. ["Pune", "Mumbai"]; empty = all India


class PredictorResult(BaseModel):
    college_slug: str
    college_name: str
    short_name: str
    city: str
    type: str
    image: str
    course: str
    cutoff: str
    cutoff_value: float
    general_cutoff: str
    estimated: bool
    chance: Chance
    fees_min: int
    fees_max: int
    avg_package: float


class PredictorOut(BaseModel):
    exam: str
    metric: Metric
    score: float
    category: Category
    results: List[PredictorResult]


class PredictionLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam: str
    metric: Metric
    score: float
    category: Category
    cities: List[str]
    results: int
    high: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Bucket(BaseModel):
    label: str
    count: int


class ExamReport(BaseModel):
    exam: str
    metric: Metric
    searches: int
    avg_score: float
    buckets: List[Bucket]
    categories: Dict[str, int]


class PredictorReport(BaseModel):
    total_searches: int
    last_7_days: int
    predictor_leads: int
    exams: List[ExamReport]
    recent: List[PredictionLog]
