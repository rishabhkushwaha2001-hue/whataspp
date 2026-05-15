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
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    plan_type: str = "Monthly" # Monthly, Quarterly, Half-Yearly, Yearly, Custom
    age: Optional[int] = None
    weight: Optional[float] = None
    trainer_assigned: Optional[str] = "General"
    payment_mode: Optional[str] = "Cash"
    category: Optional[str] = "New"

class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    monthly_fees: Optional[float] = None
    plan_duration_months: Optional[int] = None
    status: Optional[str] = None

class PaymentBase(BaseModel):
    member_id: str
    amount: float
    plan_duration: int
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    payment_method: str = "Cash"
    notes: Optional[str] = None

class PaymentInDB(PaymentBase):
    id: str = Field(alias="_id")

class AttendanceBase(BaseModel):
    member_id: str
    check_in_time: datetime = Field(default_factory=datetime.utcnow)
    status: str = "Present"

class AttendanceInDB(AttendanceBase):
    id: str = Field(alias="_id")
    photo_url: Optional[str] = None

class MemberInDB(MemberCreate):
    id: str = Field(alias="_id")
    next_due_date: datetime
    status: str
    remaining_days: Optional[int] = None

class DashboardStats(BaseModel):
    total_members: int
    active_members: int
    expiring_soon: int
    pending_payments: int
    total_revenue: float
    monthly_revenue: float
    new_members_this_month: int
    plan_distribution: dict # e.g., {"Monthly": 10, "Yearly": 5}

class MessageCreate(BaseModel):
    recipient_phone: str
    message_body: str
    status: str = "sent"

class MessageInDB(MessageCreate):
    id: str = Field(alias="_id")
    sent_at: datetime = Field(default_factory=datetime.utcnow)

class GymSettings(BaseModel):
    gym_name: str = "MBUDDY GYM"
    address: Optional[str] = "Premium Health Club"
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
