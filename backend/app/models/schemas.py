from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MemberCreate(BaseModel):
    full_name: str
    phone: str
    address: str
    joining_date: datetime
    monthly_fees: float
    plan_duration_months: int
    gender: str

class MemberInDB(MemberCreate):
    id: str = Field(alias="_id")
    next_due_date: datetime
    status: str

class MessageCreate(BaseModel):
    recipient_phone: str
    message_body: str
    status: str = "sent"

class MessageInDB(MessageCreate):
    id: str = Field(alias="_id")
    sent_at: datetime = Field(default_factory=datetime.utcnow)
