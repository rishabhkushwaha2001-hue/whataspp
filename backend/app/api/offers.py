from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models.schemas import OfferCreate, OfferInDB
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

@router.get("/", response_model=List[OfferInDB])
async def get_offers(db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    offers_cursor = db["offers"].find().sort("created_at", -1)
    offers = await offers_cursor.to_list(length=100)
    
    for o in offers:
        o["_id"] = str(o["_id"])
    return offers

@router.post("/", response_model=OfferInDB)
async def create_offer(offer: OfferCreate, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    offer_dict = offer.dict()
    offer_dict["created_at"] = datetime.now(timezone.utc)
    
    result = await db["offers"].insert_one(offer_dict)
    
    created_offer = await db["offers"].find_one({"_id": result.inserted_id})
    created_offer["_id"] = str(created_offer["_id"])
    return created_offer

@router.put("/{offer_id}", response_model=OfferInDB)
async def update_offer(offer_id: str, offer_update: dict, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    if not ObjectId.is_valid(offer_id):
        raise HTTPException(status_code=400, detail="Invalid offer ID")
        
    offer_update.pop("_id", None)
    # Convert valid_until from string to datetime if provided
    if "valid_until" in offer_update and isinstance(offer_update["valid_until"], str):
        try:
            offer_update["valid_until"] = datetime.fromisoformat(offer_update["valid_until"].replace("Z", "+00:00"))
        except ValueError:
            pass
            
    result = await db["offers"].update_one(
        {"_id": ObjectId(offer_id)},
        {"$set": offer_update}
    )
    
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    updated_offer = await db["offers"].find_one({"_id": ObjectId(offer_id)})
    updated_offer["_id"] = str(updated_offer["_id"])
    return updated_offer

@router.delete("/{offer_id}")
async def delete_offer(offer_id: str, db: AsyncIOMotorDatabase = Depends(get_tenant_db)):
    if not ObjectId.is_valid(offer_id):
        raise HTTPException(status_code=400, detail="Invalid offer ID")
        
    result = await db["offers"].delete_one({"_id": ObjectId(offer_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    return {"message": "Offer deleted successfully"}
