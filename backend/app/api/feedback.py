from fastapi import APIRouter, HTTPException, Depends
from typing import List, Any
from datetime import datetime, timezone
from models.schemas import FeedbackBase, FeedbackInDB
from database import get_database
from bson import ObjectId

router = APIRouter()

@router.get("/", response_model=List[FeedbackInDB])
async def get_feedbacks(db = Depends(get_database)):
    cursor = db["feedbacks"].find().sort("created_at", -1)
    feedbacks = await cursor.to_list(length=1000)
    for fb in feedbacks:
        fb["_id"] = str(fb["_id"])
    return feedbacks

@router.post("/")
async def create_feedback(feedback: FeedbackBase, db = Depends(get_database)):
    feedback_dict = feedback.model_dump()
    result = await db["feedbacks"].insert_one(feedback_dict)
    feedback_dict["_id"] = str(result.inserted_id)
    return feedback_dict

@router.put("/{feedback_id}/status")
async def update_feedback_status(feedback_id: str, status: str, db = Depends(get_database)):
    fb = await db["feedbacks"].find_one({"_id": ObjectId(feedback_id)})
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    await db["feedbacks"].update_one(
        {"_id": ObjectId(feedback_id)},
        {"$set": {"status": status}}
    )
    return {"message": f"Feedback status updated to {status}."}
