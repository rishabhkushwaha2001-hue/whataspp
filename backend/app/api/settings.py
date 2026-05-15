from fastapi import APIRouter, HTTPException
from typing import Any
from models.schemas import GymSettings
from database import get_database

router = APIRouter()

@router.get("/", response_model=GymSettings)
async def get_settings() -> Any:
    db = get_database()
    settings = await db["settings"].find_one({"type": "gym_profile"})
    if not settings:
        return GymSettings()
    
    # Sanitize for Pydantic
    if "_id" in settings:
        settings["_id"] = str(settings["_id"])
    return settings

@router.post("/", response_model=GymSettings)
async def update_settings(settings_in: GymSettings) -> Any:
    db = get_database()
    settings_dict = settings_in.dict()
    settings_dict["type"] = "gym_profile"
    
    await db["settings"].update_one(
        {"type": "gym_profile"},
        {"$set": settings_dict},
        upsert=True
    )
    
    return settings_dict
