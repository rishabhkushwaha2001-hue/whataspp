import asyncio
from datetime import datetime, timezone, timedelta
from app.database import client

async def main():
    db_names = await client.list_database_names()
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc + timedelta(hours=5, minutes=30)
    print("now_ist:", now_ist)
    
    days_ahead = 7
    end_of_target_ist = (now_ist + timedelta(days=days_ahead)).replace(hour=23, minute=59, second=59, microsecond=999999)
    threshold = end_of_target_ist - timedelta(hours=5, minutes=30)
    print("threshold (7 days ahead):", threshold)

    for name in db_names:
        if name.startswith("gym_") or name == "whatasppmsg":
            db = client[name]
            cursor = db["members"].find({
                "status": {"$in": ["active", "expired"]},
                "next_due_date": {"$ne": None, "$lte": threshold}
            })
            members = await cursor.to_list(length=100)
            print(f"\n===============================")
            print(f"DATABASE: {name} | Due count (active+expired) <= {threshold}: {len(members)}")
            for m in members:
                print(f" * {m.get('full_name')} | status={m.get('status')} | next_due_date={m.get('next_due_date')}")
            print(f"===============================")

if __name__ == "__main__":
    asyncio.run(main())
