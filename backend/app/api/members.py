from fastapi import APIRouter, HTTPException
from typing import Any, List
from datetime import datetime
from dateutil.relativedelta import relativedelta
from models.schemas import MemberCreate, MemberInDB
from database import get_database

router = APIRouter()

@router.post("/", response_model=MemberInDB)
async def create_member(member_in: MemberCreate) -> Any:
    db = get_database()
    member_dict = member_in.dict()
    plan_months = member_dict.get("plan_duration_months", 1)
    member_dict["next_due_date"] = member_dict["joining_date"] + relativedelta(months=plan_months)
    member_dict["status"] = "active"
    result = await db["members"].insert_one(member_dict)
    created = await db["members"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created

@router.get("/status/due", response_model=List[MemberInDB])
async def get_due_members(days_ahead: int = 30) -> Any:
    db = get_database()
    threshold_date = datetime.utcnow() + relativedelta(days=days_ahead)
    query = {"status": "active", "next_due_date": {"$lte": threshold_date}}
    cursor = db["members"].find(query).sort("next_due_date", 1)
    members = await cursor.to_list(length=100)
    for m in members: m["_id"] = str(m["_id"])
    return members
