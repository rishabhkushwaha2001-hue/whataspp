from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models.schemas import MembershipPlan, MembershipPlanInDB
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

@router.get("/", response_model=List[MembershipPlanInDB])
async def get_plans(db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    plans_cursor = db["plans"].find().sort("price", 1)
    plans = await plans_cursor.to_list(length=100)
    
    for p in plans:
        p["_id"] = str(p["_id"])
    return plans

@router.post("/", response_model=MembershipPlanInDB)
async def create_plan(plan: MembershipPlan, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    plan_dict = plan.dict()
    plan_dict["created_at"] = datetime.now(timezone.utc)
    
    result = await db["plans"].insert_one(plan_dict)
    
    created_plan = await db["plans"].find_one({"_id": result.inserted_id})
    created_plan["_id"] = str(created_plan["_id"])
    return created_plan

@router.put("/{plan_id}", response_model=MembershipPlanInDB)
async def update_plan(plan_id: str, plan_update: dict, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(status_code=400, detail="Invalid plan ID")
        
    plan_update.pop("_id", None)
    
    result = await db["plans"].update_one(
        {"_id": ObjectId(plan_id)},
        {"$set": plan_update}
    )
    
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    updated_plan = await db["plans"].find_one({"_id": ObjectId(plan_id)})
    updated_plan["_id"] = str(updated_plan["_id"])
    return updated_plan

@router.delete("/{plan_id}")
async def delete_plan(plan_id: str, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    if not ObjectId.is_valid(plan_id):
        raise HTTPException(status_code=400, detail="Invalid plan ID")
        
    result = await db["plans"].delete_one({"_id": ObjectId(plan_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    return {"message": "Plan deleted successfully"}
