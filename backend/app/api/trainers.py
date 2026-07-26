from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Any
from pydantic import BaseModel
from database import tenant_db_var
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

router = APIRouter()

async def get_tenant_db() -> AsyncIOMotorDatabase:
    db = tenant_db_var.get()
    if db is None:
        raise HTTPException(status_code=400, detail="Tenant context not found")
    return db

class TrainerCreate(BaseModel):
    name: str
    phone: str
    specialization: Optional[str] = "General Coach"
    shift_timing: Optional[str] = "Full Day (6 AM - 10 PM)"
    salary: Optional[float] = 0.0
    experience_years: Optional[int] = 1
    status: Optional[str] = "active"
    is_active: Optional[bool] = True

class TrainerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    specialization: Optional[str] = None
    shift_timing: Optional[str] = None
    salary: Optional[float] = None
    experience_years: Optional[int] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/", response_model=List[Any])
async def get_trainers(db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    cursor = db["trainers"].find({"is_active": {"$ne": False}}).sort("name", 1)
    trainers = await cursor.to_list(length=100)
    
    for t in trainers:
        t["_id"] = str(t["_id"])
        # Count assigned active members
        name = t.get("name")
        if name:
            count = await db["members"].count_documents({"status": "active", "trainer_assigned": name})
            t["assigned_members_count"] = count
        else:
            t["assigned_members_count"] = 0
    return trainers

@router.post("/", response_model=Any)
async def create_trainer(payload: TrainerCreate, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    trainer_dict = payload.dict()
    trainer_dict["created_at"] = datetime.now(timezone.utc)
    
    result = await db["trainers"].insert_one(trainer_dict)
    created = await db["trainers"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    created["assigned_members_count"] = 0
    return created

@router.put("/{trainer_id}", response_model=Any)
async def update_trainer(trainer_id: str, payload: TrainerUpdate, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    if not ObjectId.is_valid(trainer_id):
        raise HTTPException(status_code=400, detail="Invalid trainer ID")
        
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    result = await db["trainers"].update_one(
        {"_id": ObjectId(trainer_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
        
    updated = await db["trainers"].find_one({"_id": ObjectId(trainer_id)})
    updated["_id"] = str(updated["_id"])
    name = updated.get("name")
    updated["assigned_members_count"] = await db["members"].count_documents({"status": "active", "trainer_assigned": name}) if name else 0
    return updated

@router.delete("/{trainer_id}", response_model=Any)
async def delete_trainer(trainer_id: str, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    if not ObjectId.is_valid(trainer_id):
        raise HTTPException(status_code=400, detail="Invalid trainer ID")
        
    result = await db["trainers"].update_one(
        {"_id": ObjectId(trainer_id)},
        {"$set": {"is_active": False, "status": "inactive"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
        
    return {"success": True, "message": "Trainer removed successfully"}
