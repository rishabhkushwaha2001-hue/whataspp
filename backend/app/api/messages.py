from fastapi import APIRouter
from typing import Any, List
from datetime import datetime
from models.schemas import MessageCreate, MessageInDB
from database import get_database

router = APIRouter()

@router.post("/log", response_model=MessageInDB)
async def log_message(msg_in: MessageCreate) -> Any:
    db = get_database()
    msg_dict = msg_in.dict()
    msg_dict["sent_at"] = datetime.utcnow()
    
    print(f"DEBUG: Logging message to {msg_dict['recipient_phone']}")
    
    try:
        result = await db["messages"].insert_one(msg_dict)
        created = await db["messages"].find_one({"_id": result.inserted_id})
        created["_id"] = str(created["_id"])
        return created
    except Exception as e:
        print(f"DEBUG: Error saving message: {e}")
        raise

@router.get("/history", response_model=List[MessageInDB])
async def get_message_history(limit: int = 10) -> Any:
    db = get_database()
    cursor = db["messages"].find().sort("sent_at", -1).limit(limit)
    messages = await cursor.to_list(length=limit)
    for m in messages:
        m["_id"] = str(m["_id"])
    return messages
