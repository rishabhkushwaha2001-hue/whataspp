from fastapi import APIRouter, Query
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
    except Exception:
        raise

@router.get("/history", response_model=List[MessageInDB])
async def get_message_history(limit: int = Query(default=10, le=100)) -> Any:
    db = get_database()
    # BUG FIX: Don't filter by active members — show ALL recent logs regardless of member status.
    # Previous code excluded messages for expired members which caused Dashboard logs to be empty.
    cursor = db["messages"].find({}).sort("sent_at", -1).limit(limit)
    messages = await cursor.to_list(length=limit)
    for m in messages:
        m["_id"] = str(m["_id"])
    return messages
