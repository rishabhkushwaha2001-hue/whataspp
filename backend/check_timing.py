import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['whatsapp_crm']
    cursor = db['members'].find({'timing': {'$ne': None}})
    async for m in cursor:
        print(f"Timing: '{m.get('timing', '')}'")

asyncio.run(main())
