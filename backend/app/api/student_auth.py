from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from database import super_admin_db, client

router = APIRouter()

class StudentLoginRequest(BaseModel):
    phone: str
    pin: str

@router.post("/login")
async def student_login(payload: StudentLoginRequest):
    # Extract last 10 numeric digits
    phone_clean = "".join(filter(str.isdigit, payload.phone))[-10:]
    
    if not phone_clean or len(phone_clean) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number.")
        
    # Find all active tenants
    cursor = super_admin_db["gyms"].find({"status": "active"})
    active_gyms = await cursor.to_list(length=1000)
    
    memberships = []
    
    for gym in active_gyms:
        gym_id = gym.get("gym_id")
        business_type = gym.get("business_type", "gym")
        gym_name = gym.get("gym_name", "Unknown")
        
        # Access tenant db
        tenant_db = client[f"gym_{gym_id}"]
        
        # Search for member
        member = await tenant_db["members"].find_one({
            "phone": {"$regex": f"{phone_clean}$"}
        })
        
        if member:
            # Check PIN (default: last 4 digits of phone)
            # In a real app we'd have a hashed pin field, but we fallback to last 4 digits
            expected_pin = member.get("pin", phone_clean[-4:])
            
            if payload.pin == expected_pin:
                memberships.append({
                    "gym_id": gym_id,
                    "gym_name": gym_name,
                    "business_type": business_type,
                    "member_id": str(member["_id"]),
                    "name": member.get("name"),
                    "plan_status": member.get("status", "active")
                })
                
    if not memberships:
        raise HTTPException(
            status_code=404,
            detail="No memberships found with this number and PIN."
        )
        
    return {
        "status": "success",
        "memberships": memberships
    }
