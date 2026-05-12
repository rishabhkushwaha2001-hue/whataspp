from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from fastapi.responses import StreamingResponse
from typing import Any, List
import csv
import io
from datetime import datetime
from dateutil.relativedelta import relativedelta
from models.schemas import MemberCreate, MemberInDB, DashboardStats, MemberUpdate
from database import get_database

router = APIRouter()

@router.post("/", response_model=MemberInDB)
async def create_member(member_in: MemberCreate) -> Any:
    db = get_database()
    member_dict = member_in.dict()
    
    # Calculate expiry date based on plan duration
    plan_months = member_dict.get("plan_duration_months", 1)
    joining_date = member_dict["joining_date"]
    next_due_date = joining_date + relativedelta(months=plan_months)
    
    member_dict["next_due_date"] = next_due_date
    member_dict["status"] = "active"
    
    # Calculate remaining days
    now = datetime.utcnow()
    # Ensure next_due_date is naive for comparison if joining_date was naive
    if next_due_date.tzinfo is not None:
        next_due_date = next_due_date.replace(tzinfo=None)
        
    delta = next_due_date - now
    member_dict["remaining_days"] = max(0, delta.days)
    
    result = await db["members"].insert_one(member_dict)
    
    # Log initial payment
    payment_log = {
        "member_id": str(result.inserted_id),
        "amount": member_dict["monthly_fees"],
        "plan_duration": member_dict["plan_duration_months"],
        "payment_date": datetime.utcnow(),
        "payment_method": "Cash",
        "notes": "Initial payment during enrollment"
    }
    await db["payments"].insert_one(payment_log)
    
    created = await db["members"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created

@router.get("/", response_model=List[MemberInDB])
async def get_all_members() -> Any:
    db = get_database()
    cursor = db["members"].find().sort("joining_date", -1)
    members = await cursor.to_list(length=1000)
    for m in members:
        m["_id"] = str(m["_id"])
        # Update remaining days on the fly
        now = datetime.utcnow()
        due_date = m["next_due_date"]
        if due_date.tzinfo is not None:
            due_date = due_date.replace(tzinfo=None)
            
        delta = due_date - now
        m["remaining_days"] = max(0, delta.days)
    return members

@router.get("/status/due", response_model=List[MemberInDB])
async def get_due_members(days_ahead: int = 3) -> Any:
    db = get_database()
    threshold_date = datetime.utcnow() + relativedelta(days=days_ahead)
    query = {"status": "active", "next_due_date": {"$lte": threshold_date}}
    cursor = db["members"].find(query).sort("next_due_date", 1)
    members = await cursor.to_list(length=100)
    for m in members:
        m["_id"] = str(m["_id"])
        now = datetime.utcnow()
        due_date = m["next_due_date"]
        if due_date.tzinfo is not None:
            due_date = due_date.replace(tzinfo=None)
            
        delta = due_date - now
        m["remaining_days"] = max(0, delta.days)
    return members

@router.get("/stats/dashboard", response_model=DashboardStats)
async def get_dashboard_stats() -> Any:
    db = get_database()
    now = datetime.utcnow()
    
    total_members = await db["members"].count_documents({})
    active_members = await db["members"].count_documents({"status": "active"})
    
    # Expiring soon (next 7 days)
    soon = now + relativedelta(days=7)
    expiring_soon = await db["members"].count_documents({
        "status": "active", 
        "next_due_date": {"$gte": now, "$lte": soon}
    })
    
    # Overdue
    overdue = await db["members"].count_documents({
        "status": "active",
        "next_due_date": {"$lt": now}
    })
    
    # Revenue calculations
    now = datetime.utcnow()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Total Revenue (Sum of all monthly_fees from all members)
    total_pipeline = [{"$group": {"_id": None, "total": {"$sum": {"$toDouble": "$monthly_fees"}}}}]
    total_cursor = db["members"].aggregate(total_pipeline)
    total_result = await total_cursor.to_list(length=1)
    total_revenue = total_result[0]["total"] if total_result else 0.0

    # Monthly Revenue (For now, showing total active revenue to match user expectations)
    monthly_revenue = total_revenue 
    
    # New members this month
    new_members = await db["members"].count_documents({"joining_date": {"$gte": start_of_month}})
    
    # Plan distribution
    plans = ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "Custom"]
    plan_dist = {}
    for plan in plans:
        count = await db["members"].count_documents({"plan_type": plan})
        plan_dist[plan] = count
        
    return {
        "total_members": total_members,
        "active_members": active_members,
        "expiring_soon": expiring_soon,
        "pending_payments": overdue,
        "total_revenue": total_revenue,
        "monthly_revenue": monthly_revenue,
        "new_members_this_month": new_members,
        "plan_distribution": plan_dist
    }

@router.post("/{member_id}/checkin")
async def member_checkin(member_id: str) -> Any:
    db = get_database()
    # Check if member exists
    member = await db["members"].find_one({"_id": ObjectId(member_id)})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Log attendance
    attendance = {
        "member_id": member_id,
        "member_name": member["full_name"],
        "check_in_time": datetime.utcnow()
    }
    await db["attendance"].insert_one(attendance)
    return {"message": f"Checked in {member['full_name']}"}

@router.get("/attendance/today")
async def get_today_attendance() -> Any:
    db = get_database()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    cursor = db["attendance"].find({"check_in_time": {"$gte": today_start}}).sort("check_in_time", -1)
    logs = await cursor.to_list(length=100)
    for l in logs:
        l["_id"] = str(l["_id"])
    return logs

@router.get("/{member_id}/payments")
async def get_member_payments(member_id: str) -> Any:
    db = get_database()
    cursor = db["payments"].find({"member_id": member_id}).sort("payment_date", -1)
    payments = await cursor.to_list(length=100)
    for p in payments:
        p["_id"] = str(p["_id"])
    return payments

@router.get("/export/csv")
# ... existing export logic ...
async def export_members_csv() -> Any:
    db = get_database()
    cursor = db["members"].find({})
    members = await cursor.to_list(length=1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Full Name", "Phone", "Plan Type", "Duration (Months)", "Joining Date", "Next Due Date", "Status", "Fees", "Address"])
    
    for m in members:
        writer.writerow([
            m.get("full_name"),
            m.get("phone"),
            m.get("plan_type"),
            m.get("plan_duration_months"),
            m.get("joining_date"),
            m.get("next_due_date"),
            m.get("status"),
            m.get("monthly_fees"),
            m.get("address")
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gym_members.csv"}
    )
