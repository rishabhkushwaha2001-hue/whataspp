from fastapi import APIRouter
from typing import Any
from datetime import datetime
from app.models.schemas import MessageCreate, MessageInDB
from app.database import get_database

router = APIRouter()

@router.post("/log", response_model=MessageInDB)
async def log_message(msg_in: MessageCreate) -> Any:
    db = get_database()
    msg_dict = msg_in.dict()
    msg_dict["sent_at"] = datetime.utcnow()
    result = await db["messages"].insert_one(msg_dict)
    created = await db["messages"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created
