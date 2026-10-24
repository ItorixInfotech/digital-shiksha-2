from typing import Dict, List, Literal

from pydantic import BaseModel, Field

from models.predictor import PredictorIn

AIKind = Literal["colleges", "courses", "exams", "articles"]


class FaqOut(BaseModel):
    question: str
    answer: str


class AIContentIn(BaseModel):
    kind: AIKind
    fields: Dict[str, str | int | float | bool | None] = Field(default_factory=dict)  # current form values (facts)
    instructions: str = Field(default="", max_length=500)


class AIContentOut(BaseModel):
    text: Dict[str, str]  # field key -> drafted text (colleges: overview, admission; courses/exams: overview; articles: excerpt, content)
    faqs: List[FaqOut] = Field(default_factory=list)


class AISeoIn(BaseModel):
    kind: AIKind | Literal["page"]
    fields: Dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class AISeoOut(BaseModel):
    meta_title: str
    meta_description: str
    keywords: List[str]


class AIStatus(BaseModel):
    configured: bool
    model: str


class ChatIn(BaseModel):
    session_id: str = Field(pattern=r"^[A-Za-z0-9-]{16,64}$")
    message: str = Field(min_length=1, max_length=800)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatHistory(BaseModel):
    messages: List[ChatMessage]


class AdviceIn(BaseModel):
    prediction: PredictorIn


class AdviceOut(BaseModel):
    advice: str
