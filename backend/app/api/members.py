from fastapi import APIRouter, HTTPException, Query, status
from bson import ObjectId
from fastapi.responses import StreamingResponse, HTMLResponse
from typing import Any, List, Optional
import csv
import io
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from models.schemas import MemberCreate, MemberInDB, DashboardStats, MemberUpdate
from database import get_database

router = APIRouter()

async def generate_member_id(db) -> str:
    count = await db["members"].count_documents({})
    return f"GYM-{1000 + count + 1}"

@router.post("/", response_model=MemberInDB)
async def create_member(member_in: MemberCreate) -> Any:
    db = get_database()
    
    # Check for duplicate phone number
    existing_member = await db["members"].find_one({"phone": member_in.phone})
    if existing_member:
        raise HTTPException(status_code=400, detail=f"Member with phone {member_in.phone} already exists!")
        
    member_dict = member_in.dict()
    
    # Calculate expiry date based on plan duration
    plan_months = member_dict.get("plan_duration_months", 1)
    joining_date = member_dict["joining_date"]
    if joining_date.tzinfo is None:
        joining_date = joining_date.replace(tzinfo=timezone.utc)
        
    next_due_date = joining_date + relativedelta(months=plan_months)
    
    member_dict["next_due_date"] = next_due_date
    member_dict["status"] = "active"
    member_dict["member_id"] = await generate_member_id(db)
    member_dict["created_at"] = joining_date # Set creation to joining date so stats align
    
    result = await db["members"].insert_one(member_dict)
    
    # Log initial payment with joining_date
    payment_log = {
        "member_id": str(result.inserted_id),
        "amount": member_dict.get("monthly_fees", 0.0),
        "plan_duration": member_dict.get("plan_duration_months", 1),
        "payment_date": joining_date,
        "payment_method": member_dict.get("payment_mode", "Cash"),
        "type": "New Enrollment"
    }
    await db["payments"].insert_one(payment_log)
    
    created = await db["members"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created

@router.get("/", response_model=List[MemberInDB])
async def get_all_members() -> Any:
    db = get_database()
    cursor = db["members"].find().sort("created_at", -1)
    members = await cursor.to_list(length=1000)
    for m in members:
        m["_id"] = str(m["_id"])
    return members

@router.get("/status/due", response_model=List[Any])
async def get_due_members(days_ahead: int = 7) -> Any:
    db = get_database()
    now = datetime.now(timezone.utc)
    threshold = now + timedelta(days=days_ahead)
    query = {"status": "active", "next_due_date": {"$lte": threshold}}
    cursor = db["members"].find(query).sort("next_due_date", 1)
    members = await cursor.to_list(length=100)
    for m in members:
        m["_id"] = str(m["_id"])
        expiry = m["next_due_date"].replace(tzinfo=timezone.utc)
        m["remaining_days"] = (expiry - now).days
    return members

@router.get("/stats/dashboard", response_model=Any)
async def get_dashboard_stats(period: str = 'all') -> Any:
    db = get_database()
    now = datetime.now(timezone.utc)
    
    total_members = await db["members"].count_documents({})
    active_members = await db["members"].count_documents({"status": "active", "next_due_date": {"$gt": now}})
    
    # Expiring soon (next 7 days)
    soon = now + timedelta(days=7)
    expiring_soon = await db["members"].count_documents({
        "status": "active", 
        "next_due_date": {"$gte": now, "$lte": soon}
    })
    
    # Overdue
    overdue = await db["members"].count_documents({
        "next_due_date": {"$lt": now}
    })
    
    # Revenue Calculations
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if period == 'year':
        start_of_period = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = now + timedelta(days=366)
    elif period == 'prev_month':
        first_day_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = first_day_this_month
        start_of_period = (first_day_this_month - timedelta(days=1)).replace(day=1)
    elif period == 'all':
        start_of_period = now.replace(year=2000, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = now + timedelta(days=3660) # Far future
    else: # Default to month
        start_of_period = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = now + timedelta(days=32)
    
    # Revenue based on period
    period_payments_cursor = db["payments"].find({"payment_date": {"$gte": start_of_period, "$lt": end_of_period}})
    period_payments = await period_payments_cursor.to_list(length=5000)
    monthly_revenue = sum(float(p.get("amount", 0)) for p in period_payments)
    
    # Today's Collections (Always today)
    today_payments_cursor = db["payments"].find({"payment_date": {"$gte": start_of_today}})
    today_payments = await today_payments_cursor.to_list(length=1000)
    todays_collections = sum(float(p.get("amount", 0)) for p in today_payments)
    
    # Category Counts (Based on Period)
    new_members = await db["members"].count_documents({"created_at": {"$gte": start_of_period, "$lt": end_of_period}, "category": "New"})
    renewal_members = await db["members"].count_documents({"created_at": {"$gte": start_of_period, "$lt": end_of_period}, "category": "Renewal"})
    manual_members = await db["members"].count_documents({"created_at": {"$gte": start_of_period, "$lt": end_of_period}, "category": "Manual"})
    
    return {
        "total_members": total_members,
        "active_members": active_members,
        "expired_members": total_members - active_members,
        "expiring_soon": expiring_soon,
        "pending_payments": overdue,
        "overdue_payments": overdue,
        "monthly_revenue": monthly_revenue,
        "todays_collections": todays_collections,
        "new_members_count": new_members,
        "renewal_members_count": renewal_members,
        "manual_members_count": manual_members
    }

@router.get("/attendance/today")
async def get_today_attendance() -> Any:
    db = get_database()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cursor = db["attendance"].find({"check_in_time": {"$gte": today_start}}).sort("check_in_time", -1)
    logs = await cursor.to_list(length=100)
    for l in logs:
        l["id"] = str(l["_id"])
    return logs

@router.post("/admin/reset-database")
async def reset_database():
    db = get_database()
    await db["members"].delete_many({})
    await db["payments"].delete_many({})
    await db["attendance"].delete_many({})
    return {"message": "Database reset successfully"}

@router.get("/{member_id}", response_model=Any) # Changed to Any because we are attaching extra non-schema fields
async def get_member_summary(member_id: str) -> Any:
    db = get_database()
    # Optimize lookup using $or query
    query = {"$or": [{"member_id": member_id}, {"phone": member_id}]}
    if len(member_id) == 24:
        try:
            query["$or"].append({"_id": ObjectId(member_id)})
        except: pass
    
    member = await db["members"].find_one(query)
    if not member:
        # Fallback for plain string ID if ObjectId failed but it's not member_id/phone
        member = await db["members"].find_one({"_id": member_id})

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    member["_id"] = str(member["_id"])
    
    # Fetch payment history
    cursor = db["payments"].find({"member_id": member["_id"]}).sort("payment_date", 1)
    payments = await cursor.to_list(length=100)
    
    # Map to UI keys
    formatted_payments = []
    for p in payments:
        formatted_payments.append({
            "amount": p.get("amount", 0),
            "date": p.get("payment_date"),
            "plan_months": p.get("plan_duration", 1),
            "payment_mode": p.get("payment_method", "Cash"),
            "type": p.get("type", "Payment")
        })
        
    member["payment_history"] = formatted_payments
    
    return member

@router.post("/{member_id}/checkin")
async def member_checkin(member_id: str) -> Any:
    db = get_database()
    member = await db["members"].find_one({"_id": ObjectId(member_id)})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    attendance = {
        "member_id": str(member["_id"]),
        "member_name": member["full_name"],
        "check_in_time": datetime.now(timezone.utc)
    }
    await db["attendance"].insert_one(attendance)
    return {"message": f"Checked in {member['full_name']}"}

from pydantic import BaseModel

class RenewPayload(BaseModel):
    plan_duration_months: int = 1
    amount: float
    payment_mode: str = "Cash"

@router.post("/{member_id}/renew")
async def renew_member(member_id: str, payload: RenewPayload) -> Any:
    db = get_database()
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    # Calculate new due date
    now = datetime.now(timezone.utc)
    current_due = member.get("next_due_date")
    if current_due and current_due.tzinfo is None:
        current_due = current_due.replace(tzinfo=timezone.utc)
        
    # If member is already expired, renew from today. If still active, add to existing due date.
    if current_due and current_due > now:
        base_date = current_due
    else:
        base_date = now
        
    new_due_date = base_date + relativedelta(months=payload.plan_duration_months)
    
    # Update member
    await db["members"].update_one(
        {"_id": member["_id"]},
        {
            "$set": {
                "next_due_date": new_due_date,
                "status": "active",
                "category": "Renewal"
            }
        }
    )
    
    # Log payment
    payment_log = {
        "member_id": str(member["_id"]),
        "amount": payload.amount,
        "plan_duration": payload.plan_duration_months,
        "payment_date": now,
        "payment_method": payload.payment_mode,
        "type": "Renewal"
    }
    await db["payments"].insert_one(payment_log)
    
    return {"message": "Membership renewed successfully", "new_due_date": new_due_date}

@router.get("/{member_id}/payments")
async def get_member_payments(member_id: str) -> Any:
    db = get_database()
    
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    actual_id = str(member["_id"]) if member else member_id
    
    cursor = db["payments"].find({"member_id": actual_id}).sort("payment_date", -1)
    payments = await cursor.to_list(length=100)
    for p in payments:
        p["_id"] = str(p["_id"])
    return payments

@router.get("/{member_id}/receipt")
async def get_receipt(member_id: str) -> HTMLResponse:
    db = get_database()
    
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    # Fetch gym settings
    settings = await db["settings"].find_one({"type": "gym_profile"}) or {}
    gym_name = settings.get("gym_name", "MBUDDY GYM")
    gym_address = settings.get("address", "Premium Health Club")
    
    # Get last payment
    last_payment = await db["payments"].find_one(
        {"member_id": str(member["_id"])},
        sort=[("payment_date", -1)]
    )
    
    amount = last_payment["amount"] if last_payment else member.get("monthly_fees", 0)
    pay_date = last_payment["payment_date"] if last_payment else member.get("joining_date")
    pay_date_str = pay_date.strftime("%d %B %Y") if pay_date else "N/A"
    next_due_str = member.get("next_due_date").strftime("%d %B %Y") if member.get("next_due_date") else "N/A"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - {member.get('full_name')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            body {{ font-family: 'Inter', sans-serif; background: #f3f4f6; padding: 20px; display: flex; justify-content: center; }}
            .receipt-card {{ background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 400px; width: 100%; }}
            .header {{ text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }}
            .logo {{ font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -1px; }}
            .sub {{ color: #6b7280; font-size: 14px; margin-top: 4px; }}
            .title {{ text-align: center; font-size: 18px; font-weight: 600; color: #10b981; margin-bottom: 30px; letter-spacing: 2px; text-transform: uppercase; }}
            .row {{ display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; }}
            .label {{ color: #6b7280; }}
            .val {{ color: #111827; font-weight: 600; text-align: right; }}
            .total-row {{ border-top: 2px solid #f3f4f6; padding-top: 15px; margin-top: 15px; font-size: 18px; }}
            .footer {{ text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }}
            .print-btn {{ display: block; width: 100%; background: #111827; color: white; border: none; padding: 15px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 30px; cursor: pointer; }}
            @media print {{
                body {{ background: white; padding: 0; }}
                .receipt-card {{ box-shadow: none; padding: 0; }}
                .print-btn {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <div class="receipt-card">
            <div class="header">
                <div class="logo">{gym_name}</div>
                <div class="sub">{gym_address}</div>
            </div>
            <div class="title">Official Receipt</div>
            
            <div class="row"><span class="label">Date:</span><span class="val">{pay_date_str}</span></div>
            <div class="row"><span class="label">Member ID:</span><span class="val">{member.get('member_id')}</span></div>
            <div class="row"><span class="label">Name:</span><span class="val">{member.get('full_name')}</span></div>
            <div class="row"><span class="label">Phone:</span><span class="val">{member.get('phone')}</span></div>
            
            <div class="row total-row">
                <span class="label" style="color:#111827;">Amount Paid:</span>
                <span class="val" style="color:#10b981; font-size: 22px;">₹{amount}</span>
            </div>
            
            <div class="row" style="margin-top:20px;"><span class="label">Valid Until:</span><span class="val">{next_due_str}</span></div>
            
            <button class="print-btn" onclick="window.print()">Download / Print PDF</button>
            
            <div class="footer">Thank you for crushing your goals with us! 💪</div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.delete("/{member_id}")
async def delete_member(member_id: str) -> Any:
    db = get_database()
    
    # Locate the member
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    actual_id = str(member["_id"])
    
    # Delete Member
    await db["members"].delete_one({"_id": member["_id"]})
    
    # Delete associated records
    await db["payments"].delete_many({"member_id": actual_id})
    await db["attendance"].delete_many({"member_id": actual_id})
    
    return {"message": "Member and all related data deleted successfully"}

@router.get("/export/csv")

async def export_members_csv() -> Any:
    db = get_database()
    cursor = db["members"].find({})
    members = await cursor.to_list(length=1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Full Name", "Phone", "Joining Date", "Next Due Date", "Status", "Fees"])
    for m in members:
        writer.writerow([m.get("full_name"), m.get("phone"), m.get("joining_date"), m.get("next_due_date"), m.get("status"), m.get("monthly_fees")])
    output.seek(0)
    return StreamingResponse(io.BytesIO(output.getvalue().encode()), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=gym_members.csv"})
