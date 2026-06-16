from fastapi import APIRouter, HTTPException, Request
from typing import Any
from models.schemas import GymSettings
from database import get_database, super_admin_db

router = APIRouter()

@router.get("/", response_model=GymSettings)
async def get_settings(request: Request) -> Any:
    db = get_database()
    settings = await db["settings"].find_one({"type": "gym_profile"})
    if not settings:
        gym_id = request.headers.get("X-Tenant-ID")
        default_settings = GymSettings()
        if gym_id:
            gym_info = await super_admin_db["gyms"].find_one({"gym_id": gym_id})
            if gym_info:
                default_settings.gym_name = gym_info.get("gym_name", "Gym Name")
                default_settings.business_type = gym_info.get("business_type", "gym")
        return default_settings
    
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
