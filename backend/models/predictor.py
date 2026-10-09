"""College predictor models. Mirrored in frontend/src/lib/types.ts."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Metric = Literal["percentile", "score", "rank"]
Chance = Literal["High", "Medium", "Reach"]


class PredictorExam(BaseModel):
    name: str
    metric: Metric
    min: float
    max: float
    label: str
    hint: str


class PredictorIn(BaseModel):
    exam: str
    score: float = Field(ge=0)
    city: Optional[str] = None  # "Pune" | "Mumbai" | None (all)


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
    chance: Chance
    fees_min: int
    fees_max: int
    avg_package: float


class PredictorOut(BaseModel):
    exam: str
    metric: Metric
    score: float
    results: List[PredictorResult]
