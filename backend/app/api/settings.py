from fastapi import APIRouter, HTTPException, Request
from typing import Any
from datetime import datetime, timezone
from models.schemas import GymSettings
from database import get_database, super_admin_db

router = APIRouter()

@router.get("/", response_model=GymSettings)
async def get_settings(request: Request) -> Any:
    db = get_database()
    settings = await db["settings"].find_one({"type": "gym_profile"})
    # Get gym plan expiry info
    gym_id = request.headers.get("X-Tenant-ID")
    plan_expiry_date = None
    plan_days_left = None
    if gym_id:
        gym_info = await super_admin_db["gyms"].find_one({"gym_id": gym_id})
        if gym_info:
            if not settings:
                default_settings = GymSettings()
                default_settings.gym_name = gym_info.get("gym_name", "Gym Name")
                default_settings.business_type = gym_info.get("business_type", "gym")
            
            expiry = gym_info.get("plan_expiry")
            if expiry:
                if isinstance(expiry, str):
                    try:
                        # Sometimes stored as string ISO format or YYYY-MM-DD
                        expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                    except:
                        try:
                            expiry = datetime.strptime(expiry, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                        except:
                            pass
                
                if isinstance(expiry, datetime):
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    plan_expiry_date = expiry.strftime("%Y-%m-%d")
                    days_left = (expiry - datetime.now(timezone.utc)).days
                    plan_days_left = days_left if days_left >= 0 else 0

    if not settings:
        if 'default_settings' not in locals():
            default_settings = GymSettings()
        default_settings.plan_expiry_date = plan_expiry_date
        default_settings.plan_days_left = plan_days_left
        return default_settings
    
    # Sanitize for Pydantic
    if "_id" in settings:
        settings["_id"] = str(settings["_id"])
    
    settings["plan_expiry_date"] = plan_expiry_date
    settings["plan_days_left"] = plan_days_left
    
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
