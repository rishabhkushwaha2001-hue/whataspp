import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def test_db():
    load_dotenv()
    url = "mongodb+srv://rishabhkushwaha2001_db_user:7V2sVGFL97imUCyL@cluster0.0ldbgsx.mongodb.net/?appName=Cluster0"
    db_name = "whatasppmsg"
    
    print(f"Connecting to {db_name}...")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    try:
        count = await db["members"].count_documents({})
        print(f"Total Members in DB: {count}")
        
        if count > 0:
            sample = await db["members"].find_one()
            print("Sample member data:")
            print(sample)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_db())
