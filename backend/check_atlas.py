import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import MONGODB_URL, DATABASE_NAME

async def check_db():
    print(f"Connecting to MongoDB at {MONGODB_URL}...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    member_count = await db["members"].count_documents({})
    payments_count = await db["payments"].count_documents({})
    
    print(f"Total Members in Cloud DB: {member_count}")
    print(f"Total Payments in Cloud DB: {payments_count}")
    
    payments = await db["payments"].find().to_list(length=100)
    total_rev = sum(float(p.get("amount", 0)) for p in payments)
    print(f"Total All-Time Revenue: {total_rev}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())
