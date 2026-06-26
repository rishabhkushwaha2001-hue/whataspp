import asyncio
import re
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

def parse_timing(timing_str):
    try:
        parts = re.split(r'-|TO', timing_str.upper())
        if len(parts) == 2:
            def parse_time_part(t_str):
                t_str = re.sub(r'(AM|PM)', r' \1', t_str.strip().replace(" ", ""))
                t_str = t_str.replace("  ", " ").strip()
                try:
                    return datetime.strptime(t_str, "%I:%M %p")
                except ValueError:
                    try:
                        return datetime.strptime(t_str, "%I %p")
                    except ValueError:
                        return datetime.strptime(t_str, "%H:%M")
                        
            start_dt = parse_time_part(parts[0])
            end_dt   = parse_time_part(parts[1])
            return start_dt.hour * 60 + start_dt.minute, end_dt.hour * 60 + end_dt.minute
    except Exception as e:
        print(f"Exception parsing '{timing_str}': {e}")
        pass
    return -1, -1

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["whatsapp_db"]  # Guessing DB name? Wait, let's check backend/database.py
    
    # Or just try common names:
    for db_name in ["whataspsp", "whatsapp_db", "gym_db", "test"]:
        collections = await client[db_name].list_collection_names()
        if "members" in collections:
            print(f"Found DB: {db_name}")
            db = client[db_name]
            break
            
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc + timedelta(hours=5, minutes=30)
    current_time_minutes = now_ist.hour * 60 + now_ist.minute
    print(f"Current IST Time: {now_ist.strftime('%H:%M')} ({current_time_minutes} min)")

    cursor = db["members"].find({"status": "active", "allocated_seat": {"$ne": None}})
    members = await cursor.to_list(length=10)
    for m in members:
        timing = m.get("timing", "")
        seat = m.get("allocated_seat", "")
        start, end = parse_timing(timing)
        active = False
        if start != -1 and end != -1:
            if end < start:
                active = current_time_minutes >= start or current_time_minutes < end
            else:
                active = start <= current_time_minutes <= end
        print(f"Member: {m.get('full_name')} | Seat: {seat} | Timing: '{timing}' | parsed: {start}-{end} | active: {active}")

if __name__ == "__main__":
    asyncio.run(main())
