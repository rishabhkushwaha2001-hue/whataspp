from fastapi import APIRouter, HTTPException, status, Query
from typing import Any, List, Optional
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from pydantic import BaseModel
import random
import string
from database import super_admin_db, client

router = APIRouter()

# Input validation schemas
class SuperAdminLogin(BaseModel):
    phone: str
    super_admin_id: str

class GymCreate(BaseModel):
    owner_name: str
    phone: str
    gym_name: str
    address: str
    plan_duration_months: int = 1
    plan_price: float = 0.0
    plan_expiry: Optional[str] = None
    business_type: str = "gym"  # gym | library | general

class GymUpdateStatus(BaseModel):
    status: str # active, inactive, suspended

class GymRenew(BaseModel):
    plan_duration_months: int
    plan_price: float
    plan_expiry: Optional[str] = None

class CustomWhatsAppMessage(BaseModel):
    phone: str
    message: str

# Helper to generate unique activation code
def generate_activation_code() -> str:
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"KGM-ACT-{suffix}"

# Helper to generate unique Tenant ID
async def generate_gym_id(business_type: str) -> str:
    prefix = "GYM"
    if business_type == "library":
        prefix = "LIB"
    elif business_type == "general":
        prefix = "CBT"
        
    last_gym = await super_admin_db["gyms"].find_one({"gym_id": {"$regex": f"^{prefix}_"}}, sort=[("_id", -1)])
    if last_gym and "gym_id" in last_gym:
        try:
            last_id = int(last_gym["gym_id"].split("_")[1])
            return f"{prefix}_{last_id + 1}"
        except:
            pass
    count = await super_admin_db["gyms"].count_documents({"gym_id": {"$regex": f"^{prefix}_"}})
    return f"{prefix}_{200 + count + 1}"

# Helper: Get default WhatsApp message templates based on business type
def get_default_templates(business_type: str, gym_name: str) -> dict:
    if business_type == "library":
        return {
            "joining_msg_template": (
                "*{library_name} - MEMBERSHIP CONFIRMATION 📚*\n\n"
                "Dear *{name}*,\n\n"
                "Welcome to {library_name}! Your membership has been successfully registered. We are committed to providing you with a silent and productive study environment.\n\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "👤 *Member Phone:* {phone}\n"
                "📅 *Joining Date:* {joining_date}\n"
                "⏰ *Allotted Timings:* {hours} Hours/Day ({timing})\n"
                "🪑 *Assigned Seat:* {seat}\n"
                "📶 *Wi-Fi Details:* {wifi}\n"
                "💰 *Fees Paid:* ₹{fees}\n"
                "📅 *Valid Till:* {date}\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "Please maintain silence inside the premises. Happy studying! 🚀"
            ),
            "renewal_msg_template": (
                "*{library_name} - MEMBERSHIP RENEWED 📚*\n\n"
                "Dear *{name}*,\n\n"
                "Your library membership has been successfully renewed.\n\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "⏰ *Allotted Timings:* {hours} Hours/Day ({timing})\n"
                "🪑 *Assigned Seat:* {seat}\n"
                "📶 *Wi-Fi Details:* {wifi}\n"
                "💰 *Amount Paid:* ₹{fees}\n"
                "📅 *New Expiry Date:* {date}\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "Keep reading, keep growing! 📖🚀"
            ),
            "reminder_msg_template": (
                "*{library_name} - RENEWAL REMINDER 🔔*\n\n"
                "Dear *{name}* 📚,\n\n"
                "This is a gentle reminder that your library membership is due for renewal.\n\n"
                "💰 *Pending Fees:* ₹{fees}\n"
                "📅 *Due Date:* {date}\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "Please renew your membership to continue accessing your assigned seat ({seat}) and Wi-Fi. Thank you! 🚀"
            )
        }
    elif business_type == "general":
        return {
            "joining_msg_template": (
                "*{business_name} - SERVICE ACTIVATED ✅*\n\n"
                "Hello *{name}*!\n\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "📅 *Date:* {joining_date}\n"
                "💰 *Amount Paid:* ₹{fees}\n"
                "📅 *Valid Till:* {date}\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "Thank you for choosing {business_name}! 🙏"
            ),
            "renewal_msg_template": (
                "*{business_name} - PLAN RENEWED ✅*\n\n"
                "Hello *{name}*! Your plan has been renewed.\n\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "💰 *Amount Paid:* ₹{fees}\n"
                "📅 *Valid Till:* {date}\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "Thank you for continuing with {business_name}! 🙏"
            ),
            "reminder_msg_template": (
                "*{business_name} - PAYMENT REMINDER 🔔*\n\n"
                "Hello *{name}*,\n\n"
                "This is a friendly reminder that your payment is due.\n\n"
                "*AMOUNT DUE:* ₹{fees}\n"
                "*DUE DATE:* {date}\n\n"
                "Please contact us for renewal. Thank you! 🙏"
            )
        }
    else:  # gym (default)
        return {
            "joining_msg_template": (
                "*{gym_name} - WELCOME KIT 🧾*\n\n"
                "Hello *{name}*, welcome to {gym_name}! 💪\n\n"
                "*MEMBERSHIP DETAILS:*\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "📱 *Phone:* {phone}\n"
                "📅 *Joining Date:* {joining_date}\n"
                "💰 *Amount Paid:* ₹{fees}\n"
                "📅 *Expiry Date:* {date}\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "*Stay Strong & Crush Your Goals!* 🚀"
            ),
            "renewal_msg_template": (
                "*{gym_name} - MEMBERSHIP RENEWED 🔄*\n\n"
                "Hello *{name}*, thank you for continuing your journey with us! 💪\n\n"
                "*RENEWAL DETAILS:*\n"
                "━━━━━━━━━━━━━━━━━━━━\n"
                "💰 *Amount Paid:* ₹{fees}\n"
                "📅 *New Expiry:* {date}\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "*Let's push your limits again!* 🚀"
            ),
            "reminder_msg_template": (
                "*{gym_name} - RENEWAL REMINDER 🔔*\n\n"
                "Hello *{name}* 💪,\n\n"
                "Your membership is due for renewal.\n\n"
                "*PENDING FEES:* ₹{fees} 💰\n"
                "*DUE DATE:* {date} 📅\n"
                "━━━━━━━━━━━━━━━━━━━━\n\n"
                "*Don't break the momentum!* 🚀\n\n"
                "See you at the gym! 🏋️‍♂️"
            )
        }

# Super Admin Login Route
@router.post("/login")
async def login_super_admin(payload: SuperAdminLogin) -> Any:
    # Fixed Credentials validation
    if payload.phone == "8081161524" and payload.super_admin_id == "142001_kush":
        return {
            "status": "success",
            "message": "Super Admin login successful",
            "is_admin": True,
            "super_admin_id": payload.super_admin_id
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Super Admin credentials"
    )

# Register a new Gym
@router.post("/gyms")
async def register_gym(gym_in: GymCreate) -> Any:
    # Check if phone already exists
    existing = await super_admin_db["gyms"].find_one({"phone": gym_in.phone})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A gym with owner phone {gym_in.phone} is already registered!"
        )
        
    gym_id = await generate_gym_id(gym_in.business_type)
    activation_code = generate_activation_code()
    
    now = datetime.now(timezone.utc)
    if gym_in.plan_expiry:
        try:
            # Parse 'YYYY-MM-DD'
            expiry_date = datetime.strptime(gym_in.plan_expiry, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            expiry_date = now + relativedelta(months=gym_in.plan_duration_months)
    else:
        expiry_date = now + relativedelta(months=gym_in.plan_duration_months)
    
    gym_dict = {
        "gym_id": gym_id,
        "activation_code": activation_code,
        "owner_name": gym_in.owner_name,
        "phone": gym_in.phone,
        "gym_name": gym_in.gym_name,
        "address": gym_in.address,
        "plan_duration_months": gym_in.plan_duration_months,
        "plan_price": gym_in.plan_price,
        "plan_expiry": expiry_date,
        "status": "active",
        "business_type": gym_in.business_type,
        "created_at": now
    }
    
    # Save to super admin DB
    await super_admin_db["gyms"].insert_one(gym_dict)
    
    # Pre-seed the new tenant's database with default gym settings profile + business type + templates
    tenant_db = client[f"gym_{gym_id}"]
    default_templates = get_default_templates(gym_in.business_type, gym_in.gym_name)
    enable_hours = gym_in.business_type == "library"
    await tenant_db["settings"].update_one(
        {"type": "gym_profile"},
        {
            "$set": {
                "type": "gym_profile",
                "gym_name": gym_in.gym_name,
                "address": gym_in.address,
                "phone": gym_in.phone,
                "logo_url": None,
                "email": None,
                "website": None,
                "business_type": gym_in.business_type,
                "enable_hours_feature": enable_hours,
                **default_templates
            }
        },
        upsert=True
    )
    
    # Generate automated WhatsApp notifications
    reg_msg = f"*Aetheron Management System - REGISTRATION SUCCESSFUL* 🎉\n\nDear *{gym_in.owner_name}*,\n\nYour mobile number *{gym_in.phone}* has been registered successfully as the Owner of *{gym_in.gym_name}*."
    
    act_msg = (
        f"*Aetheron Management System - ACTIVATION DETAILS* 🔑\n\n"
        f"Hi *{gym_in.owner_name}*,\n"
        f"Your separate isolated database has been created successfully!\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 *Tenant ID:* `{gym_id}`\n"
        f"🔑 *Activation Code:* `{activation_code}`\n"
        f"━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🚀 *Login Instructions:*\n"
        f"1. Open the App.\n"
        f"2. Select 'Admin / Owner' mode.\n"
        f"3. Enter your registered mobile number: *{gym_in.phone}*.\n"
        f"4. Enter your activation code: *{activation_code}*.\n\n"
        f"Welcome to the premium management experience! 🏢"
    )
    
    # Log these in the global whatsapp_logs collection
    await super_admin_db["whatsapp_logs"].insert_many([
        {
            "phone": gym_in.phone,
            "message": reg_msg,
            "type": "registration_success",
            "logged_at": now,
            "sent": False
        },
        {
            "phone": gym_in.phone,
            "message": act_msg,
            "type": "activation_details",
            "logged_at": now,
            "sent": False
        }
    ])
    
    # Prepare response
    gym_dict["_id"] = str(gym_dict["_id"])
    return {
        "message": "Gym registered and isolated database seeded successfully!",
        "gym": gym_dict,
        "notifications": {
            "registration": reg_msg,
            "activation": act_msg
        }
    }

# Get list of all registered gyms
@router.get("/gyms")
async def get_all_gyms(q: Optional[str] = None) -> Any:
    query = {}
    if q:
        # Search by Gym Name, Owner Name, Phone, Address
        query["$or"] = [
            {"gym_name": {"$regex": q, "$options": "i"}},
            {"owner_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"address": {"$regex": q, "$options": "i"}}
        ]
        
    cursor = super_admin_db["gyms"].find(query).sort("created_at", -1)
    gyms = await cursor.to_list(length=1000)
    
    # Format for response
    now = datetime.now(timezone.utc)
    type_counts = {"gym": 0, "library": 0, "general": 0}
    for gym in gyms:
        gym["_id"] = str(gym["_id"])
        # Ensure plan_expiry is datetime
        expiry = gym.get("plan_expiry")
        if expiry:
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            gym["is_expired"] = expiry < now
            gym["days_remaining"] = (expiry - now).days
        else:
            gym["is_expired"] = True
            gym["days_remaining"] = 0
        # Count by business type
        btype = gym.get("business_type", "gym")
        if btype in type_counts:
            type_counts[btype] += 1
        else:
            type_counts[btype] = type_counts.get(btype, 0) + 1
            
    return {
        "gyms": gyms,
        "total": len(gyms),
        "type_breakdown": type_counts
    }

# Update a gym's status (Active/Inactive/Suspended)
@router.post("/gyms/{gym_id}/status")
async def update_gym_status(gym_id: str, payload: GymUpdateStatus) -> Any:
    gym = await super_admin_db["gyms"].find_one({"gym_id": gym_id})
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
        
    await super_admin_db["gyms"].update_one(
        {"gym_id": gym_id},
        {"$set": {"status": payload.status}}
    )
    
    # Log WhatsApp notification of status change
    now = datetime.now(timezone.utc)
    status_msg = (
        f"*Aetheron Management System - ACCOUNT STATUS UPDATE* 🔔\n\n"
        f"Dear *{gym['owner_name']}*,\n\n"
        f"Your Account for *{gym['gym_name']}* status has been updated to *{payload.status.upper()}* by Super Admin.\n\n"
        f"Please contact Super Admin for any queries."
    )
    
    await super_admin_db["whatsapp_logs"].insert_one({
        "phone": gym["phone"],
        "message": status_msg,
        "type": f"status_change_{payload.status}",
        "logged_at": now,
        "sent": False
    })
    
    return {
        "message": f"Gym status updated to {payload.status} successfully!",
        "notification": status_msg
    }

# Renew/Extend gym subscription
@router.post("/gyms/{gym_id}/renew")
async def renew_gym_plan(gym_id: str, payload: GymRenew) -> Any:
    gym = await super_admin_db["gyms"].find_one({"gym_id": gym_id})
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
        
    now = datetime.now(timezone.utc)
    if payload.plan_expiry:
        try:
            # Parse 'YYYY-MM-DD'
            new_expiry = datetime.strptime(payload.plan_expiry, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            current_expiry = gym.get("plan_expiry")
            if current_expiry and current_expiry.tzinfo is None:
                current_expiry = current_expiry.replace(tzinfo=timezone.utc)
            base_date = current_expiry if current_expiry and current_expiry > now else now
            new_expiry = base_date + relativedelta(months=payload.plan_duration_months)
    else:
        current_expiry = gym.get("plan_expiry")
        if current_expiry and current_expiry.tzinfo is None:
            current_expiry = current_expiry.replace(tzinfo=timezone.utc)
        base_date = current_expiry if current_expiry and current_expiry > now else now
        new_expiry = base_date + relativedelta(months=payload.plan_duration_months)
    
    await super_admin_db["gyms"].update_one(
        {"gym_id": gym_id},
        {
            "$set": {
                "plan_expiry": new_expiry,
                "plan_duration_months": payload.plan_duration_months,
                "plan_price": payload.plan_price,
                "status": "active" # Auto reactivate on renewal
            }
        }
    )
    
    # Log renewal WhatsApp message
    renewal_msg = (
        f"*Aetheron Management System - SUBSCRIPTION RENEWED* ✅\n\n"
        f"Hi *{gym['owner_name']}* 🎉,\n"
        f"Your software subscription for *{gym['gym_name']}* has been successfully renewed!\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📅 *New Expiry Date:* {new_expiry.strftime('%d %B %Y')}\n"
        f"⏱️ *Duration:* {payload.plan_duration_months} Month(s)\n"
        f"💳 *Price:* ₹{payload.plan_price}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Thank you for your business! Let's continue growing! 🏢"
    )
    
    await super_admin_db["whatsapp_logs"].insert_one({
        "phone": gym["phone"],
        "message": renewal_msg,
        "type": "plan_renewal",
        "logged_at": now,
        "sent": False
    })
    
    return {
        "message": "Subscription renewed successfully!",
        "new_expiry": new_expiry,
        "notification": renewal_msg
    }

# Delete a gym and its complete database
@router.delete("/gyms/{gym_id}")
async def delete_gym(gym_id: str) -> Any:
    gym = await super_admin_db["gyms"].find_one({"gym_id": gym_id})
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
        
    # Delete from main super admin gyms list
    await super_admin_db["gyms"].delete_one({"gym_id": gym_id})
    
    # DROP the dynamic database!
    await client.drop_database(f"gym_{gym_id}")
    
    return {"message": f"Gym {gym['gym_name']} and its isolated database (gym_{gym_id}) have been deleted successfully!"}

# Send manual custom WhatsApp message
@router.post("/send-message")
async def send_custom_message(payload: CustomWhatsAppMessage) -> Any:
    now = datetime.now(timezone.utc)
    
    # Insert custom message into global logs
    await super_admin_db["whatsapp_logs"].insert_one({
        "phone": payload.phone,
        "message": payload.message,
        "type": "custom_manual",
        "logged_at": now,
        "sent": False
    })
    
    return {
        "message": "Custom WhatsApp message logged and prepared for sending!",
        "phone": payload.phone,
        "message_body": payload.message
    }

# Get WhatsApp pending/sent log history
@router.get("/whatsapp-logs")
async def get_whatsapp_logs(limit: int = 50) -> Any:
    now = datetime.now(timezone.utc)
    
    # 1. Fetch active gyms (status is active and not expired)
    active_gyms = await super_admin_db["gyms"].find({
        "status": "active",
        "plan_expiry": {"$gt": now}
    }).to_list(length=1000)
    
    active_phones = [g["phone"] for g in active_gyms]
    
    # 2. Query logs only for these active gym phones
    cursor = super_admin_db["whatsapp_logs"].find({
        "phone": {"$in": active_phones}
    }).sort("logged_at", -1).limit(limit)
    
    logs = await cursor.to_list(length=limit)
    
    # Fetch all registered gyms to resolve names accurately
    all_gyms = await super_admin_db["gyms"].find({}).to_list(length=2000)
    gym_map = {g["phone"]: g for g in all_gyms}
    
    for l in logs:
        l["_id"] = str(l["_id"])
        gym = gym_map.get(l["phone"])
        if gym:
            l["gym_name"] = gym.get("gym_name", "N/A")
            l["owner_name"] = gym.get("owner_name", "N/A")
        else:
            l["gym_name"] = "N/A"
            l["owner_name"] = "N/A"
            
    return logs

# Mark WhatsApp log as sent
@router.post("/whatsapp-logs/{log_id}/sent")
async def mark_log_as_sent(log_id: str) -> Any:
    from bson import ObjectId
    try:
        await super_admin_db["whatsapp_logs"].update_one(
            {"_id": ObjectId(log_id)},
            {"$set": {"sent": True}}
        )
        return {"status": "success", "message": "Log marked as sent"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
