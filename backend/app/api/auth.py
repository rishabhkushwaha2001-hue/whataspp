from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timezone
from database import super_admin_db

router = APIRouter()

# Input Validation Schemas
class PhoneVerifyRequest(BaseModel):
    phone: str

class ActivateRequest(BaseModel):
    phone: str
    activation_code: str

@router.post("/verify-phone")
async def verify_phone(payload: PhoneVerifyRequest):
    # Extract last 10 numeric digits to handle country codes, spaces, or formatting
    phone_clean = "".join(filter(str.isdigit, payload.phone))[-10:]
    
    # Unified check: If it's the Super Admin's phone number
    if phone_clean == "8081161524":
        return {
            "status": "success",
            "is_admin": True,
            "message": "Super Admin recognized! Enter security admin ID.",
            "gym_name": "Super Admin Panel",
            "owner_name": "Kush"
        }

    # Search for gym by phone in super admin DB for normal owners
    # Use matching on sanitized last 10 digits using regex
    gym = await super_admin_db["gyms"].find_one({
        "phone": {"$regex": f"{phone_clean}$"}
    })
    if not gym:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your mobile number is not registered. Please contact Super Admin."
        )
        
    if gym.get("status") in ["inactive", "suspended"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your gym account is currently {gym.get('status')}. Please contact Super Admin."
        )
        
    return {
        "status": "success",
        "is_admin": False,
        "message": "Phone number verified successfully",
        "gym_name": gym.get("gym_name"),
        "owner_name": gym.get("owner_name")
    }

@router.post("/activate")
async def activate_gym(payload: ActivateRequest):
    # Extract last 10 numeric digits to handle country codes, spaces, or formatting
    phone_clean = "".join(filter(str.isdigit, payload.phone))[-10:]

    # Unified check: If it's the Super Admin phone, verify Admin Security ID as code
    if phone_clean == "8081161524":
        if payload.activation_code.strip() == "142001_kush":
            return {
                "status": "success",
                "is_admin": True,
                "message": "Welcome Kush. Opening Master Control Dashboard.",
                "gym_id": "super_admin",
                "gym_name": "Super Admin Control Panel",
                "owner_name": "Kush"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Super Admin Security ID."
            )

    # Find matching gym for normal owners
    gym = await super_admin_db["gyms"].find_one({
        "phone": {"$regex": f"{phone_clean}$"},
        "activation_code": payload.activation_code.strip()
    })
    
    if not gym:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number or Activation Code."
        )
        
    # Check Status
    if gym.get("status") in ["inactive", "suspended"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your gym account is currently {gym.get('status')}. Please contact Super Admin."
        )
        
    # Check Plan Expiry
    now = datetime.now(timezone.utc)
    expiry = gym.get("plan_expiry")
    if expiry:
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if expiry < now:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription plan has expired! Please contact Super Admin for renewal."
            )
            
    return {
        "status": "success",
        "is_admin": False,
        "message": "Gym activated and connected successfully!",
        "gym_id": gym.get("gym_id"),
        "gym_name": gym.get("gym_name"),
        "owner_name": gym.get("owner_name")
    }

