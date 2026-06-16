from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone

class MemberCreate(BaseModel):
    full_name: str
    phone: str
    address: str
    joining_date: datetime
    next_due_date: Optional[datetime] = None
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
    daily_hours: Optional[int] = None  # Library-specific: daily study hours (e.g. 8, 10)
    timing: Optional[str] = None        # Library-specific: study timing (e.g. 9 AM - 5 PM)

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
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payment_method: str = "Cash"
    notes: Optional[str] = None

class PaymentInDB(PaymentBase):
    id: str = Field(alias="_id")

class AttendanceBase(BaseModel):
    member_id: str
    check_in_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "Present"

class AttendanceInDB(AttendanceBase):
    id: str = Field(alias="_id")
    photo_url: Optional[str] = None

class MemberInDB(MemberCreate):
    id: str = Field(alias="_id")
    member_id: Optional[str] = None  # Server-generated ID like GYM-1001
    next_due_date: datetime
    status: str
    remaining_days: Optional[int] = None
    created_at: Optional[datetime] = None

class DashboardStats(BaseModel):
    total_members: int
    active_members: int
    expired_members: int
    expiring_soon: int
    pending_payments: int
    total_revenue: float
    monthly_revenue: float
    new_members_count: int
    renewal_members_count: int
    manual_members_count: int

class MessageCreate(BaseModel):
    recipient_phone: str
    message_body: str
    status: str = "sent"

class MessageInDB(MessageCreate):
    id: str = Field(alias="_id")
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GymSettings(BaseModel):
    gym_name: str = "Gym Name"
    address: Optional[str] = "Gym Address"
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    # Multi-business type support
    business_type: Optional[str] = "gym"          # gym | library | general
    enable_hours_feature: Optional[bool] = False   # Show daily_hours field in member form
    # Custom WhatsApp message templates
    # Use {name}, {date}, {fees}, {hours}, {gym} as placeholders
    joining_msg_template: Optional[str] = None
    renewal_msg_template: Optional[str] = None
    reminder_msg_template: Optional[str] = None

class ExpenseCreate(BaseModel):
    amount: float
    category: str
    date: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

class ExpenseInDB(ExpenseCreate):
    id: str = Field(alias="_id")
