from fastapi import APIRouter, HTTPException, Query, status, UploadFile, File
from bson import ObjectId
from fastapi.responses import StreamingResponse, HTMLResponse
from typing import Any, List, Optional
import csv
import io
import re
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from models.schemas import MemberCreate, MemberInDB, DashboardStats, MemberUpdate
from database import get_database

router = APIRouter()

def parse_timing(timing_str: str):
    try:
        parts = re.split(r'-|TO', timing_str.upper())
        if len(parts) != 2: return 0, 0
        def to_minutes(t_str):
            t_str = t_str.strip()
            match = re.match(r'(\d+)(?::(\d+))?\s*(AM|PM)?', t_str)
            if not match: return 0
            h = int(match.group(1))
            m = int(match.group(2) or 0)
            ampm = match.group(3)
            if ampm == 'PM' and h != 12: h += 12
            if ampm == 'AM' and h == 12: h = 0
            return h * 60 + m
        return to_minutes(parts[0]), to_minutes(parts[1])
    except: return 0, 0

async def check_seat_overlap(db, seat_number: str, proposed_timing: str, exclude_member_id: str = None):
    if not seat_number or not proposed_timing:
        return None
    proposed_start, proposed_end = parse_timing(proposed_timing)
    if proposed_start == proposed_end == 0:
        return None
        
    query = {"allocated_seat": seat_number, "status": {"$regex": "^active$", "$options": "i"}}
    if exclude_member_id:
        query["member_id"] = {"$ne": exclude_member_id}
        
    active_members = await db["members"].find(query).to_list(length=100)
    for m in active_members:
        m_timing = m.get("timing", "")
        if not m_timing: continue
        m_start, m_end = parse_timing(m_timing)
        if m_start == m_end == 0: continue
        
        def get_minutes_set(start, end):
            if end < start: return set(range(start, 24*60)) | set(range(0, end))
            else: return set(range(start, end))
            
        if get_minutes_set(proposed_start, proposed_end).intersection(get_minutes_set(m_start, m_end)):
            return m
    return None

async def generate_member_id(db) -> str:
    settings = await db["settings"].find_one({"type": "gym_profile"})
    prefix = "GYM"
    if settings:
        b_type = settings.get("business_type", "gym")
        if b_type == "library":
            prefix = "LIB"
        elif b_type == "general":
            prefix = "GEN"

    pipeline = [
        {"$match": {"member_id": {"$regex": f"^{prefix}-"}}},
        {"$project": {"member_id": 1}},
        {"$sort": {"_id": -1}},
        {"$limit": 50}
    ]
    cursor = db["members"].aggregate(pipeline)
    docs = await cursor.to_list(length=50)
    
    max_id = 1000
    for doc in docs:
        try:
            num = int(doc["member_id"].split("-")[1])
            if num > max_id:
                max_id = num
        except:
            pass
    return f"{prefix}-{max_id + 1}"

@router.post("/", response_model=MemberInDB)
async def create_member(member_in: MemberCreate) -> Any:
    db = get_database()
    
    # Check for duplicate phone number
    existing_member = await db["members"].find_one({"phone": member_in.phone})
    if existing_member:
        raise HTTPException(status_code=400, detail=f"Member with phone {member_in.phone} already exists!")
        
    # Seat Overlap Check
    if member_in.allocated_seat and member_in.timing:
        conflict = await check_seat_overlap(db, member_in.allocated_seat, member_in.timing)
        if conflict:
            raise HTTPException(status_code=400, detail=f"Seat {member_in.allocated_seat} is already occupied by {conflict.get('full_name')} during this time ({conflict.get('timing')}). Please select another time or seat.")

    member_dict = member_in.dict()
    
    # Calculate expiry date based on plan duration if not custom provided
    joining_date = member_dict["joining_date"]
    if joining_date.tzinfo is None:
        joining_date = joining_date.replace(tzinfo=timezone.utc)
        
    next_due_date = member_dict.get("next_due_date")
    if not next_due_date:
        plan_months = member_dict.get("plan_duration_months", 1)
        next_due_date = joining_date + relativedelta(months=plan_months)
    else:
        if next_due_date.tzinfo is None:
            next_due_date = next_due_date.replace(tzinfo=timezone.utc)
            
    member_dict["next_due_date"] = next_due_date
    member_dict["status"] = "active"
    member_dict["member_id"] = await generate_member_id(db)
    member_dict["created_at"] = joining_date # Set creation to joining date so stats align
    
    result = await db["members"].insert_one(member_dict)
    
    # Log initial payment with joining_date
    payment_log = {
        "member_id": str(result.inserted_id),
        "amount": member_dict.get("monthly_fees", 0.0),
        "plan_duration": member_dict.get("plan_duration_months", 1),
        "payment_date": joining_date,
        "payment_method": member_dict.get("payment_mode", "Cash"),
        "type": "New Enrollment"
    }
    await db["payments"].insert_one(payment_log)
    
    created = await db["members"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created

@router.get("/", response_model=List[MemberInDB])
async def get_all_members() -> Any:
    db = get_database()
    cursor = db["members"].find().sort("created_at", -1)
    members = await cursor.to_list(length=1000)
    for m in members:
        m["_id"] = str(m["_id"])
    return members

@router.get("/status/due", response_model=List[Any])
async def get_due_members(days_ahead: int = 7) -> Any:
    db = get_database()
    now = datetime.now(timezone.utc)
    threshold = now + timedelta(days=days_ahead)
    query = {"status": "active", "next_due_date": {"$lte": threshold}}
    cursor = db["members"].find(query).sort("next_due_date", 1)
    members = await cursor.to_list(length=100)
    for m in members:
        m["_id"] = str(m["_id"])
        expiry = m["next_due_date"].replace(tzinfo=timezone.utc)
        m["remaining_days"] = (expiry - now).days
    return members

@router.get("/stats/dashboard", response_model=Any)
async def get_dashboard_stats(period: str = 'all') -> Any:
    db = get_database()
    now = datetime.now(timezone.utc)
    
    total_members = await db["members"].count_documents({})
    active_members = await db["members"].count_documents({"status": "active", "next_due_date": {"$gt": now}})
    
    # Expiring soon (next 7 days)
    soon = now + timedelta(days=7)
    expiring_soon = await db["members"].count_documents({
        "status": "active", 
        "next_due_date": {"$gte": now, "$lte": soon}
    })
    
    # Overdue
    overdue = await db["members"].count_documents({
        "next_due_date": {"$lt": now}
    })
    
    # Revenue Calculations
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if period == 'year':
        start_of_period = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = now + timedelta(days=366)
    elif period == 'prev_month':
        first_day_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = first_day_this_month
        start_of_period = (first_day_this_month - timedelta(days=1)).replace(day=1)
    elif period == 'all':
        start_of_period = now.replace(year=2000, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = now + timedelta(days=3660) # Far future
    else: # Default to month
        start_of_period = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_period = now + timedelta(days=32)
    
    # Revenue based on period
    period_payments_cursor = db["payments"].find({"payment_date": {"$gte": start_of_period, "$lt": end_of_period}})
    period_payments = await period_payments_cursor.to_list(length=5000)
    monthly_revenue = sum(float(p.get("amount", 0)) for p in period_payments)
    
    # Today's Collections (Always today)
    today_payments_cursor = db["payments"].find({"payment_date": {"$gte": start_of_today}})
    today_payments = await today_payments_cursor.to_list(length=1000)
    todays_collections = sum(float(p.get("amount", 0)) for p in today_payments)
    
    # Category Counts (Based on Period)
    new_members = await db["members"].count_documents({"created_at": {"$gte": start_of_period, "$lt": end_of_period}, "category": "New"})
    renewal_members = await db["members"].count_documents({"created_at": {"$gte": start_of_period, "$lt": end_of_period}, "category": "Renewal"})
    manual_members = await db["members"].count_documents({"created_at": {"$gte": start_of_period, "$lt": end_of_period}, "category": "Manual"})
    
    return {
        "total_members": total_members,
        "active_members": active_members,
        "expired_members": total_members - active_members,
        "expiring_soon": expiring_soon,
        "pending_payments": overdue,
        "overdue_payments": overdue,
        "monthly_revenue": monthly_revenue,
        "todays_collections": todays_collections,
        "new_members_count": new_members,
        "renewal_members_count": renewal_members,
        "manual_members_count": manual_members
    }

@router.get("/attendance/today")
async def get_today_attendance() -> Any:
    db = get_database()
    now = datetime.now(timezone.utc)
    # Adjust for IST to find the correct local midnight
    now_ist = now + timedelta(hours=5, minutes=30)
    today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_start_ist - timedelta(hours=5, minutes=30)
    
    cursor = db["attendance"].find({"check_in_time": {"$gte": today_start}}).sort("check_in_time", -1)
    logs = await cursor.to_list(length=100)
    for l in logs:
        l["id"] = str(l["_id"])
        # Fetch member info if missing
        if "member_name" not in l or not l["member_name"]:
            member = await db["members"].find_one({"member_id": l.get("member_id")})
            if member:
                l["member_name"] = member.get("full_name", l.get("member_id"))
                l["member_phone"] = member.get("phone", "")
    return logs

@router.post("/admin/reset-database")
async def reset_database():
    db = get_database()
    # Safety check: only allow if a tenant context is active (not the super_admin DB)
    from database import super_admin_db, tenant_db_var
    current_db = tenant_db_var.get()
    if current_db is None:
        raise HTTPException(status_code=403, detail="Reset not allowed without an active gym session.")
    await db["members"].delete_many({})
    await db["payments"].delete_many({})
    await db["attendance"].delete_many({})
    return {"message": "Database reset successfully"}

# ✅ IMPORTANT: /export/csv and /import/csv MUST be defined BEFORE /{member_id}
# Otherwise FastAPI will match "export" as a member_id (wildcard route bug)
@router.get("/export/csv")
async def export_members_csv(gym_id: str = None) -> Any:
    from database import client as db_client, get_database as _get_db, tenant_db_var
    # Resolve which database to use
    # Priority: middleware-injected tenant context (from X-Tenant-ID header)
    current_db = tenant_db_var.get()
    if current_db is not None:
        db = current_db
    elif gym_id and gym_id != 'super_admin':
        # Only allow gym_id query param if it matches the X-Tenant-ID header context
        # Since tenant middleware already set context, gym_id as fallback is safe here
        db = db_client[f"gym_{gym_id}"]
    else:
        db = _get_db()  # Will use tenant from middleware context
    cursor = db["members"].find({})
    members = await cursor.to_list(length=1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Full Name", "Phone", "Joining Date", "Next Due Date", "Status", "Fees", "Plan (Months)", "Category"])
    for m in members:
        joining_date_str = m.get("joining_date").strftime("%d/%m/%Y") if isinstance(m.get("joining_date"), datetime) else str(m.get("joining_date", ""))
        next_due_date_str = m.get("next_due_date").strftime("%d/%m/%Y") if isinstance(m.get("next_due_date"), datetime) else str(m.get("next_due_date", ""))
        writer.writerow([
            m.get("full_name", ""),
            m.get("phone", ""),
            joining_date_str,
            next_due_date_str,
            m.get("status", ""),
            m.get("monthly_fees", 0),
            m.get("plan_duration_months", 1),
            m.get("category", "New")
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gym_members.csv"}
    )

@router.post("/import/csv")
async def import_members_csv(file: UploadFile = File(...)):
    db = get_database()
    contents = await file.read()

    import io as _io
    import csv as _csv
    from dateutil.parser import parse as parse_date

    try:
        decoded = contents.decode("utf-8")
    except Exception:
        decoded = contents.decode("latin-1")

    reader = _csv.reader(_io.StringIO(decoded))
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="Empty CSV file")

    imported_count = 0
    updated_count = 0

    for row in reader:
        if not row or len(row) < 5:
            continue

        full_name = str(row[0]).strip()
        phone = ''.join(c for c in str(row[1]) if c.isdigit())
        if not full_name or not phone:
            continue

        joining_date_val = parse_date(str(row[2])) if len(row) > 2 and row[2] else datetime.now(timezone.utc)
        next_due_date_val = parse_date(str(row[3])) if len(row) > 3 and row[3] else datetime.now(timezone.utc)
        status_val = str(row[4]).strip().lower() if len(row) > 4 and row[4] else "active"
        monthly_fees_val = float(row[5]) if len(row) > 5 and row[5] else 0.0
        # BUG FIX: Read plan_duration_months (col 6) and category (col 7) from CSV
        plan_duration_val = int(float(row[6])) if len(row) > 6 and row[6] else 1
        category_val = str(row[7]).strip() if len(row) > 7 and row[7] else "New"
        # Validate category value
        if category_val not in ["New", "Renewal", "Manual"]:
            category_val = "New"

        existing = await db["members"].find_one({"phone": phone})
        if existing:
            await db["members"].update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "full_name": full_name,
                        "joining_date": joining_date_val,
                        "next_due_date": next_due_date_val,
                        "status": status_val,
                        "monthly_fees": monthly_fees_val,
                        # BUG FIX: Also update plan_duration_months and category on re-import
                        "plan_duration_months": plan_duration_val,
                        "category": category_val
                    }
                }
            )
            updated_count += 1
        else:
            member_id_str = await generate_member_id(db)
            member_dict = {
                "full_name": full_name,
                "phone": phone,
                "address": "Imported",
                "joining_date": joining_date_val,
                "next_due_date": next_due_date_val,
                "status": status_val,
                "monthly_fees": monthly_fees_val,
                "plan_duration_months": plan_duration_val,
                "gender": "Male",
                "member_id": member_id_str,
                "category": category_val,
                "created_at": joining_date_val
            }
            await db["members"].insert_one(member_dict)
            imported_count += 1

    return {"message": f"Successfully imported {imported_count} members, updated {updated_count} existing members."}

@router.get("/{member_id}", response_model=Any) # Changed to Any because we are attaching extra non-schema fields
async def get_member_summary(member_id: str) -> Any:
    db = get_database()
    # Optimize lookup using $or query
    query = {"$or": [{"member_id": member_id}, {"phone": member_id}]}
    if len(member_id) == 24:
        try:
            query["$or"].append({"_id": ObjectId(member_id)})
        except: pass
    
    member = await db["members"].find_one(query)
    if not member:
        # Fallback for plain string ID if ObjectId failed but it's not member_id/phone
        member = await db["members"].find_one({"_id": member_id})

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    member["_id"] = str(member["_id"])
    
    # Fetch payment history
    cursor = db["payments"].find({"member_id": member["_id"]}).sort("payment_date", 1)
    payments = await cursor.to_list(length=100)
    
    # Map to UI keys
    formatted_payments = []
    for p in payments:
        formatted_payments.append({
            "amount": p.get("amount", 0),
            "date": p.get("payment_date"),
            "plan_months": p.get("plan_duration", 1),
            "payment_mode": p.get("payment_method", "Cash"),
            "type": p.get("type", "Payment")
        })
        
    member["payment_history"] = formatted_payments
    
    return member



@router.post("/{member_id}/checkin")
async def member_checkin(member_id: str) -> Any:
    db = get_database()
    member = await db["members"].find_one({"_id": ObjectId(member_id)})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    attendance = {
        "member_id": str(member["_id"]),
        "member_name": member["full_name"],
        "check_in_time": datetime.now(timezone.utc)
    }
    await db["attendance"].insert_one(attendance)
    return {"message": f"Checked in {member['full_name']}"}

from pydantic import BaseModel

class EditMemberPayload(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[float] = None
    gender: Optional[str] = None
    daily_hours: Optional[int] = None
    timing: Optional[str] = None
    allocated_seat: Optional[str] = None
    wifi_details: Optional[str] = None
    trainer_assigned: Optional[str] = None
    notes: Optional[str] = None

@router.put("/{member_id}")
async def edit_member(member_id: str, payload: EditMemberPayload) -> Any:
    db = get_database()
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    new_seat = payload.allocated_seat if payload.allocated_seat is not None else member.get("allocated_seat")
    new_timing = payload.timing if payload.timing is not None else member.get("timing")
    seat_changed = payload.allocated_seat is not None and payload.allocated_seat != member.get("allocated_seat")
    timing_changed = payload.timing is not None and payload.timing != member.get("timing")

    if (seat_changed or timing_changed) and new_seat and new_timing:
        conflict = await check_seat_overlap(db, new_seat, new_timing, exclude_member_id=member.get("member_id"))
        if conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Seat {new_seat} is already occupied by {conflict.get('full_name')} during this time ({conflict.get('timing')}). Please select another time or seat."
            )

    # Build update — only non-None fields (Pydantic v2 compatible)
    try:
        update_fields = payload.model_dump(exclude_none=True)
    except AttributeError:
        update_fields = {k: v for k, v in payload.dict().items() if v is not None}

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    await db["members"].update_one({"_id": member["_id"]}, {"$set": update_fields})

    updated = await db["members"].find_one({"_id": member["_id"]})
    updated["_id"] = str(updated["_id"])
    return updated

class RenewPayload(BaseModel):
    plan_duration_months: int = 1
    amount: float
    payment_mode: str = "Cash"
    next_due_date: Optional[datetime] = None
    joining_date: Optional[datetime] = None
    daily_hours: Optional[int] = None
    timing: Optional[str] = None
    allocated_seat: Optional[str] = None

@router.post("/{member_id}/renew")
async def renew_member(member_id: str, payload: RenewPayload) -> Any:
    db = get_database()
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    # Seat Overlap Check
    new_seat = payload.allocated_seat if payload.allocated_seat is not None else member.get("allocated_seat")
    new_timing = payload.timing if payload.timing is not None else member.get("timing")
    
    if new_seat and new_timing:
        conflict = await check_seat_overlap(db, new_seat, new_timing, exclude_member_id=member.get("member_id"))
        if conflict:
            raise HTTPException(status_code=400, detail=f"Seat {new_seat} is already occupied by {conflict.get('full_name')} during this time ({conflict.get('timing')}). Please select another time or seat.")
            
    # Calculate or set new due date
    now = datetime.now(timezone.utc)
    if payload.next_due_date:
        new_due_date = payload.next_due_date
        if new_due_date.tzinfo is None:
            new_due_date = new_due_date.replace(tzinfo=timezone.utc)
            
        renewal_start_date = payload.joining_date or now
        if renewal_start_date.tzinfo is None:
            renewal_start_date = renewal_start_date.replace(tzinfo=timezone.utc)
    else:
        current_due = member.get("next_due_date")
        if current_due and current_due.tzinfo is None:
            current_due = current_due.replace(tzinfo=timezone.utc)
            
        # If member is already expired, renew from today. If still active, add to existing due date.
        if current_due and current_due > now:
            base_date = current_due
        else:
            base_date = now
            
        new_due_date = base_date + relativedelta(months=payload.plan_duration_months)
        renewal_start_date = now
    
    # Update member — also update plan_duration_months and monthly_fees
    # so profile shows correct plan and next renewal amount is calculated correctly
    update_fields = {
        "next_due_date": new_due_date,
        "status": "active",
        "category": "Renewal",
        "plan_duration_months": payload.plan_duration_months,
        "monthly_fees": payload.amount  # Update to latest paid amount
    }
    
    if payload.daily_hours is not None:
        update_fields["daily_hours"] = payload.daily_hours
    if payload.timing is not None:
        update_fields["timing"] = payload.timing
    if payload.allocated_seat is not None:
        update_fields["allocated_seat"] = payload.allocated_seat

    await db["members"].update_one(
        {"_id": member["_id"]},
        {"$set": update_fields}
    )
    
    # Log payment
    payment_log = {
        "member_id": str(member["_id"]),
        "amount": payload.amount,
        "plan_duration": payload.plan_duration_months,
        "payment_date": renewal_start_date,
        "payment_method": payload.payment_mode,
        "type": "Renewal"
    }
    await db["payments"].insert_one(payment_log)
    
    return {"message": "Membership renewed successfully", "new_due_date": new_due_date}

@router.get("/{member_id}/payments")
async def get_member_payments(member_id: str) -> Any:
    db = get_database()
    
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    actual_id = str(member["_id"]) if member else member_id
    
    cursor = db["payments"].find({"member_id": actual_id}).sort("payment_date", -1)
    payments = await cursor.to_list(length=100)
    for p in payments:
        p["_id"] = str(p["_id"])
    return payments

@router.get("/{member_id}/receipt")
async def get_receipt(member_id: str) -> HTMLResponse:
    db = get_database()
    
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    # Fetch gym settings
    settings = await db["settings"].find_one({"type": "gym_profile"}) or {}
    gym_name = settings.get("gym_name", "Gym")
    gym_address = settings.get("address", "Premium Health Club")
    
    # Get last payment
    last_payment = await db["payments"].find_one(
        {"member_id": str(member["_id"])},
        sort=[("payment_date", -1)]
    )
    
    amount = last_payment["amount"] if last_payment else member.get("monthly_fees", 0)
    pay_date = last_payment["payment_date"] if last_payment else member.get("joining_date")
    pay_date_str = pay_date.strftime("%d %B %Y") if pay_date else "N/A"
    next_due_str = member.get("next_due_date").strftime("%d %B %Y") if member.get("next_due_date") else "N/A"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - {member.get('full_name')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            body {{ font-family: 'Inter', sans-serif; background: #f3f4f6; padding: 20px; display: flex; justify-content: center; }}
            .receipt-card {{ background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 400px; width: 100%; }}
            .header {{ text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }}
            .logo {{ font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -1px; }}
            .sub {{ color: #6b7280; font-size: 14px; margin-top: 4px; }}
            .title {{ text-align: center; font-size: 18px; font-weight: 600; color: #10b981; margin-bottom: 30px; letter-spacing: 2px; text-transform: uppercase; }}
            .row {{ display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; }}
            .label {{ color: #6b7280; }}
            .val {{ color: #111827; font-weight: 600; text-align: right; }}
            .total-row {{ border-top: 2px solid #f3f4f6; padding-top: 15px; margin-top: 15px; font-size: 18px; }}
            .footer {{ text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }}
            .print-btn {{ display: block; width: 100%; background: #111827; color: white; border: none; padding: 15px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-top: 30px; cursor: pointer; }}
            @media print {{
                body {{ background: white; padding: 0; }}
                .receipt-card {{ box-shadow: none; padding: 0; }}
                .print-btn {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <div class="receipt-card">
            <div class="header">
                <div class="logo">{gym_name}</div>
                <div class="sub">{gym_address}</div>
            </div>
            <div class="title">Official Receipt</div>
            
            <div class="row"><span class="label">Date:</span><span class="val">{pay_date_str}</span></div>
            <div class="row"><span class="label">Member ID:</span><span class="val">{member.get('member_id')}</span></div>
            <div class="row"><span class="label">Name:</span><span class="val">{member.get('full_name')}</span></div>
            <div class="row"><span class="label">Phone:</span><span class="val">{member.get('phone')}</span></div>
            
            <div class="row total-row">
                <span class="label" style="color:#111827;">Amount Paid:</span>
                <span class="val" style="color:#10b981; font-size: 22px;">₹{amount}</span>
            </div>
            
            <div class="row" style="margin-top:20px;"><span class="label">Valid Until:</span><span class="val">{next_due_str}</span></div>
            
            <button class="print-btn" onclick="window.print()">Download / Print PDF</button>
            
            <div class="footer">Thank you for crushing your goals with us! 💪</div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.delete("/{member_id}")
async def delete_member(member_id: str) -> Any:
    db = get_database()
    
    # Locate the member
    member = None
    if len(member_id) == 24:
        try:
            member = await db["members"].find_one({"_id": ObjectId(member_id)})
        except: pass
    if not member:
        member = await db["members"].find_one({"member_id": member_id})
    if not member:
        member = await db["members"].find_one({"_id": member_id})
        
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    actual_id = str(member["_id"])
    member_str_id = member.get("member_id", "")
    
    # Delete Member
    await db["members"].delete_one({"_id": member["_id"]})
    
    # Delete associated payments (by ObjectId string)
    await db["payments"].delete_many({"member_id": actual_id})
    
    # Delete attendance by both _id string AND member_id (GYM-XXXX style)
    await db["attendance"].delete_many({"$or": [
        {"member_id": actual_id},
        {"member_id": member_str_id}
    ]})
    
    return {"message": "Member and all related data deleted successfully"}

# (export/csv and import/csv routes moved above /{member_id} — see above)
