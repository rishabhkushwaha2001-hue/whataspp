from fastapi import APIRouter, HTTPException
from typing import Any, List
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
    delta = next_due_date - datetime.utcnow()
    member_dict["remaining_days"] = max(0, delta.days)
    
    result = await db["members"].insert_one(member_dict)
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
        delta = m["next_due_date"] - datetime.utcnow()
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
        delta = m["next_due_date"] - datetime.utcnow()
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
    # Sum of all monthly_fees * plan_duration_months for simplicity in this demo
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$monthly_fees"}}}]
    revenue_cursor = db["members"].aggregate(pipeline)
    revenue_result = await revenue_cursor.to_list(length=1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0.0
    
    # New members this month
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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
        "monthly_revenue": total_revenue / 12, # Dummy average
        "new_members_this_month": new_members,
        "plan_distribution": plan_dist
    }
