from fastapi import APIRouter
from typing import Any, List
from datetime import datetime, timezone
from models.schemas import MessageCreate, MessageInDB
from database import get_database

router = APIRouter()

@router.post("/log", response_model=MessageInDB)
async def log_message(msg_in: MessageCreate) -> Any:
    db = get_database()
    msg_dict = msg_in.dict()
    msg_dict["sent_at"] = datetime.now(timezone.utc)
    
    try:
        result = await db["messages"].insert_one(msg_dict)
        created = await db["messages"].find_one({"_id": result.inserted_id})
        created["_id"] = str(created["_id"])
        return created
    except Exception as e:
        raise

@router.get("/history", response_model=List[MessageInDB])
async def get_message_history(limit: int = 10) -> Any:
    db = get_database()
    now = datetime.now(timezone.utc)
    
    # 1. Fetch all active members (next_due_date > now)
    active_members = await db["members"].find({
        "next_due_date": {"$gt": now}
    }).to_list(length=5000)
    
    active_phones = [m["phone"] for m in active_members]
    
    # 2. Query messages for these active phone numbers
    cursor = db["messages"].find({
        "recipient_phone": {"$in": active_phones}
    }).sort("sent_at", -1).limit(limit)
    
    messages = await cursor.to_list(length=limit)
    for m in messages:
        m["_id"] = str(m["_id"])
    return messages
