from fastapi import APIRouter, HTTPException, Depends
from typing import List, Any
from datetime import datetime, timezone, date
from models.schemas import AttendanceBase, AttendanceInDB
from database import get_database
from bson import ObjectId

router = APIRouter()

@router.get("/", response_model=List[AttendanceInDB])
async def get_attendance(date_str: str = None, db = Depends(get_database)):
    query = {}
    if date_str:
        try:
            start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            end = start.replace(hour=23, minute=59, second=59)
            query["check_in_time"] = {"$gte": start, "$lte": end}
        except ValueError:
            pass
            
    cursor = db["attendance"].aggregate([
        {"$match": query},
        {"$sort": {"check_in_time": -1}},
        {
            "$lookup": {
                "from": "members",
                "localField": "member_id",
                "foreignField": "member_id",
                "as": "member_info"
            }
        },
        {"$unwind": {"path": "$member_info", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "member_name": "$member_info.full_name",
                "member_phone": "$member_info.phone"
            }
        },
        {"$project": {"member_info": 0}}
    ])
    records = await cursor.to_list(length=1000)
    for record in records:
        record["_id"] = str(record["_id"])
    return records

@router.post("/")
async def mark_attendance(attendance: AttendanceBase, db = Depends(get_database)):
    # Prevent duplicate entry for today
    now = datetime.now(timezone.utc)
    now_ist = now + timedelta(hours=5, minutes=30)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_start_ist - timedelta(hours=5, minutes=30)
    today_end = today_start + timedelta(days=1)
    
    existing = await db["attendance"].find_one({
        "member_id": attendance.member_id,
        "check_in_time": {"$gte": today_start, "$lt": today_end}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already marked for today.")
        
    att_dict = attendance.model_dump()
    
    # Save member name and phone directly in the attendance record
    member = await db["members"].find_one({"member_id": attendance.member_id})
    if member:
        att_dict["member_name"] = member.get("full_name")
        att_dict["member_phone"] = member.get("phone")
        
    result = await db["attendance"].insert_one(att_dict)
    att_dict["_id"] = str(result.inserted_id)
    return att_dict
