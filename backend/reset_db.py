import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

# Add the current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database import MONGODB_URL, DATABASE_NAME

async def reset_db():
    print(f"Connecting to MongoDB at {MONGODB_URL}...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    collections = ["members", "payments", "attendance", "messages"]
    
    print("⚠️  Starting Database Reset...")
    for coll in collections:
        result = await db[coll].delete_many({})
        print(f"✅ Cleared {coll}: {result.deleted_count} records removed.")
    
    print("\n✨ Database is now FRESH and EMPTY! You can start adding new members.")
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_db())
