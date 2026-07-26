import asyncio
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db_names = await client.list_database_names()
    
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc + timedelta(hours=5, minutes=30)
    print(f"Current UTC: {now_utc} | Current IST: {now_ist}")
    print(f"today_month: {now_ist.month}, today_day: {now_ist.day}")
    
    for db_name in db_names:
        if "whataspp" in db_name or "gym_" in db_name:
            db = client[db_name]
            members = await db["members"].find({"$or": [{"date_of_birth": {"$ne": None}}, {"dob": {"$ne": None}}]}).to_list(100)
            if members:
                print(f"\n--- Database: {db_name} (Found {len(members)} members with DOB) ---")
                for m in members:
                    dob = m.get("date_of_birth") or m.get("dob")
                    print(f"Member: '{m.get('full_name')}' | DOB raw: {dob!r} | type: {type(dob)}")
                    try:
                        dob_month, dob_day = None, None
                        if isinstance(dob, str):
                            dob_str = dob.strip()
                            if len(dob_str) >= 10 and "-" in dob_str[:10]:
                                if "T" in dob_str or "Z" in dob_str:
                                    dt = datetime.fromisoformat(dob_str.replace("Z", "+00:00"))
                                    dt_ist = dt + timedelta(hours=5, minutes=30)
                                    dob_month, dob_day = dt_ist.month, dt_ist.day
                                else:
                                    parts = dob_str[:10].split("-")
                                    dob_month, dob_day = int(parts[1]), int(parts[2])
                        elif isinstance(dob, datetime):
                            dt_ist = dob + timedelta(hours=5, minutes=30)
                            dob_month, dob_day = dt_ist.month, dt_ist.day
                        print(f"  -> parsed IST month={dob_month}, day={dob_day} | Matches today ({now_ist.month}-{now_ist.day})? {dob_month == now_ist.month and dob_day == now_ist.day}")
                    except Exception as e:
                        print(f"  -> Error parsing: {e}")

if __name__ == "__main__":
    asyncio.run(main())
