from fastapi import APIRouter, HTTPException, Depends
from typing import List, Any
from datetime import datetime, timezone, timedelta
from models.schemas import SeatBase, SeatInDB
from database import get_database
from bson import ObjectId
from pydantic import BaseModel

router = APIRouter()

import re


@router.get("/")
async def get_seats(db = Depends(get_database)):
    # ── 1. Fetch all seats ──────────────────────────────────────────────────
    cursor = db["seats"].find()
    seats = await cursor.to_list(length=1000)

    # Natural sort: S-1, S-2 ... S-10 (not S-1, S-10, S-2)
    def sort_key(s):
        match = re.search(r'\d+', s.get("seat_number", ""))
        if match:
            return (s["seat_number"][:match.start()], int(match.group()))
        return (s.get("seat_number", ""), 0)
    seats.sort(key=sort_key)

    # ── 2. Today's attendance — single query ────────────────────────────────
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc + timedelta(hours=5, minutes=30)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_start_ist - timedelta(hours=5, minutes=30)
    today_end = today_start + timedelta(days=1)
    att_cursor = db["attendance"].find({"check_in_time": {"$gte": today_start, "$lt": today_end}})
    attendances = await att_cursor.to_list(length=2000)
    checked_in_members = {att["member_id"]: att["check_in_time"] for att in attendances}

    now_local = datetime.now()
    current_time_minutes = now_local.hour * 60 + now_local.minute

    # ── 3. ALL active assigned members — ONE single query ───────────────────
    # Build the set of seat numbers we have
    seat_numbers = {s.get("seat_number") for s in seats}
    all_members_cursor = db["members"].find({
        "allocated_seat": {"$in": list(seat_numbers)},
        "status": {"$regex": "^active$", "$options": "i"}
    })
    all_members = await all_members_cursor.to_list(length=5000)

    # Group members by seat_number in Python (O(n), no extra DB calls)
    members_by_seat: dict = {}
    for m in all_members:
        seat_num = m.get("allocated_seat")
        if seat_num:
            members_by_seat.setdefault(seat_num, []).append(m)

    # ── 4. Timing helper ────────────────────────────────────────────────────
    def parse_timing(timing_str):
        try:
            parts = re.split(r'-|TO', timing_str.upper())
            if len(parts) == 2:
                start_dt = datetime.strptime(parts[0].strip(), "%I:%M %p")
                end_dt   = datetime.strptime(parts[1].strip(), "%I:%M %p")
                return start_dt.hour * 60 + start_dt.minute, end_dt.hour * 60 + end_dt.minute
        except Exception:
            pass
        return 0, 1440

    # ── 5. Assemble response (pure Python, zero extra DB calls) ────────────
    for seat in seats:
        seat["_id"] = str(seat["_id"])
        members = members_by_seat.get(seat["seat_number"], [])

        allotted = []
        is_occupied_now = False

        for m in members:
            mid = m.get("member_id", "")
            checked_in = mid in checked_in_members
            check_in_time = checked_in_members.get(mid)
            timing = m.get("timing", "")
            start_min, end_min = parse_timing(timing)

            shift_active = False
            if end_min < start_min:   # overnight shift
                shift_active = current_time_minutes >= start_min or current_time_minutes < end_min
            else:
                shift_active = start_min <= current_time_minutes <= end_min

            if shift_active:
                is_occupied_now = True

            allotted.append({
                "_id":            str(m["_id"]),
                "member_id":      mid,
                "name":           m.get("full_name"),
                "phone":          m.get("phone"),
                "timing":         timing,
                "shift_active":   shift_active,
                "checked_in":     checked_in,
                "check_in_time":  check_in_time.isoformat() if check_in_time else None,
            })

        # Red  = at least one shift is active RIGHT NOW
        # Amber = members assigned but none in session yet
        # Green = no members at all  (handled by frontend colour logic)
        seat["allotted_members"] = allotted
        seat["live_status"] = "Occupied" if is_occupied_now else (
            "Reserved" if allotted else "Available"
        )

    return seats

@router.post("/")
async def create_seat(seat: SeatBase, db = Depends(get_database)):
    existing = await db["seats"].find_one({"seat_number": seat.seat_number})
    if existing:
        raise HTTPException(status_code=400, detail=f"Seat {seat.seat_number} already exists.")
        
    seat_dict = seat.model_dump()
    result = await db["seats"].insert_one(seat_dict)
    seat_dict["_id"] = str(result.inserted_id)
    return seat_dict

@router.post("/batch")
async def create_seats_batch(seats: List[SeatBase], db = Depends(get_database)):
    created = 0
    for seat in seats:
        existing = await db["seats"].find_one({"seat_number": seat.seat_number})
        if not existing:
            await db["seats"].insert_one(seat.model_dump())
            created += 1
    return {"message": f"{created} seats created successfully."}

@router.put("/{seat_id}/assign")
async def assign_seat(seat_id: str, member_id: str, db = Depends(get_database)):
    seat = await db["seats"].find_one({"_id": ObjectId(seat_id)})
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    if seat.get("status") == "Occupied" and seat.get("member_id") != member_id:
        raise HTTPException(status_code=400, detail="Seat is already occupied by someone else.")
        
    await db["seats"].update_one(
        {"_id": ObjectId(seat_id)},
        {"$set": {"status": "Occupied", "member_id": member_id}}
    )
    return {"message": "Seat assigned successfully."}

@router.put("/{seat_id}/vacate")
async def vacate_seat(seat_id: str, db = Depends(get_database)):
    seat = await db["seats"].find_one({"_id": ObjectId(seat_id)})
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    await db["seats"].update_one(
        {"_id": ObjectId(seat_id)},
        {"$set": {"status": "Available", "member_id": None}}
    )
    return {"message": "Seat vacated successfully."}

@router.delete("/{seat_id}")
async def delete_seat(seat_id: str, db = Depends(get_database)):
    await db["seats"].delete_one({"_id": ObjectId(seat_id)})
    return {"message": "Seat deleted successfully."}

@router.delete("/")
async def delete_all_seats(db = Depends(get_database)):
    await db["seats"].delete_many({})
    return {"message": "All seats deleted successfully."}

class BatchDeleteReq(BaseModel):
    seat_ids: List[str]

@router.post("/batch-delete")
async def batch_delete_seats(req: BatchDeleteReq, db = Depends(get_database)):
    """Delete multiple seats by their IDs in one request."""
    object_ids = []
    for sid in req.seat_ids:
        try:
            object_ids.append(ObjectId(sid))
        except Exception:
            pass
    if not object_ids:
        raise HTTPException(status_code=400, detail="No valid seat IDs provided.")
    result = await db["seats"].delete_many({"_id": {"$in": object_ids}})
    return {"message": f"{result.deleted_count} seat(s) deleted successfully."}

@router.get("/next-number")
async def get_next_seat_number(prefix: str = "S-", db = Depends(get_database)):
    """Return the next auto-incremented seat number for a given prefix."""
    cursor = db["seats"].find({"seat_number": {"$regex": f"^{re.escape(prefix)}\\d+$"}})
    seats = await cursor.to_list(length=2000)
    max_num = 0
    for s in seats:
        match = re.search(r'\d+$', s.get("seat_number", ""))
        if match:
            num = int(match.group())
            if num > max_num:
                max_num = num
    return {"prefix": prefix, "next_number": max_num + 1}

class RenameSeatReq(BaseModel):
    new_seat_number: str

@router.put("/{seat_id}/rename")
async def rename_seat(seat_id: str, req: RenameSeatReq, db = Depends(get_database)):
    seat = await db["seats"].find_one({"_id": ObjectId(seat_id)})
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
        
    existing = await db["seats"].find_one({"seat_number": req.new_seat_number})
    if existing and str(existing["_id"]) != seat_id:
        raise HTTPException(status_code=400, detail="A seat with this number already exists.")
        
    await db["seats"].update_one(
        {"_id": ObjectId(seat_id)},
        {"$set": {"seat_number": req.new_seat_number}}
    )
    return {"message": "Seat renamed successfully."}
