import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class CounsellorIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    email: Optional[EmailStr] = None
    active: bool = True


class Counsellor(CounsellorIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CounsellorWithStats(Counsellor):
    total_leads: int = 0
    new_leads: int = 0


class CounsellorSettings(BaseModel):
    auto_assign: bool = False
    reminder_template_sid: str = ""
    last_reminder: str = "not sent yet"
    fallback_numbers: List[str] = []


class CounsellorSettingsIn(BaseModel):
    auto_assign: bool
    reminder_template_sid: str = ""


class LeadAssignIn(BaseModel):
    counsellor_id: Optional[str] = None
    notify: bool = True


class ReminderRecipient(BaseModel):
    name: str
    to: str
    leads: int


class ReminderRun(BaseModel):
    queued: bool
    total_leads: int
    recipients: List[ReminderRecipient]
