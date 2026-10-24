"""College predictor models. Mirrored in frontend/src/lib/types.ts."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Metric = Literal["percentile", "score", "rank"]
Chance = Literal["High", "Medium", "Reach"]
Category = Literal["General", "OBC", "EWS", "SC", "ST", "VJ", "NT1", "NT2", "NT3", "SEBC", "TFWS"]


class PredictorExam(BaseModel):
    name: str
    metric: Metric
    min: float
    max: float
    label: str
    hint: str
    rank_note: str = ""
    fee: int = 0  # ₹; >0 = results unlock only after a verified Razorpay payment
    payment_link: str = ""
    payment_auto_check: bool = False  # True once Razorpay API keys are set (payment checked with Razorpay)


class PredictorIn(BaseModel):
    exam: str
    score: float = Field(ge=0)
    category: Category = "General"
    cities: List[str] = []  # e.g. ["Pune", "Mumbai"]; empty = all India
    # MHT CET (official CAP data) only:
    ladies: bool = False
    home_university: str = ""
    branch_group: str = ""


class UnlockIn(BaseModel):
    prediction: PredictorIn
    name: str = Field(default="", max_length=80)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")  # mobile used to pay; also gets the WhatsApp list
    email: Optional[EmailStr] = None  # receipt + full college list PDF (falls back to the Razorpay payer email)
    payment_id: str = Field(default="", pattern=r"^(pay_[A-Za-z0-9]{6,30})?$")


class UnlockOut(BaseModel):  # the unlock token itself only travels in the httpOnly ds_unlocks cookie
    payment_id: str
    exam: str
    score: float
    amount: int = 0
    email: str = ""  # payer email from Razorpay (masked) — the PDF is emailed here
    phone: str = ""  # payer mobile from Razorpay (masked)
    pdf_url: str = ""  # receipt + full college list PDF


class PredictorAccess(BaseModel):
    paid: bool  # this browser (ds_unlocks cookie) has unlocked this exam + score


class PaymentRecord(BaseModel):
    payment_id: str
    exam: str
    score: float
    name: str = ""
    phone: str
    amount: int = 0
    email: str = ""
    email_sent: bool = False
    verified: bool = False  # False = payment ID not yet checked with Razorpay (no API keys) — cross-check in dashboard
    created_at: datetime


class RoundCutoff(BaseModel):
    round: int
    percentile: Optional[float] = None
    merit_no: Optional[int] = None
    seat: str = ""


class CapMeta(BaseModel):
    available: bool
    year: int
    source: str
    colleges: int
    courses: int
    home_universities: List[str]
    branch_groups: List[str]
    categories: List[str]


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
    rounds: List[RoundCutoff] = []
    seat: str = ""
    official: bool = False
    course_code: str = ""  # official CAP choice code (unique per college × branch × shift)


class PredictorOut(BaseModel):
    exam: str
    metric: Metric
    score: float
    category: Category
    results: List[PredictorResult]
    total: int = 0
    source: str = ""


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
