from fastapi import APIRouter, Query
from datetime import datetime, timedelta, timezone
from database import get_database

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# REMINDER QUEUE — aaj ke liye saari categories ek call mein
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/today")
async def get_todays_reminders(
    inactive_days: int = Query(default=15, description="Days of absence before flagging inactive"),
    expiry_days: int   = Query(default=7,  description="Days before expiry to alert"),
):
    """
    Returns 4 categorized reminder lists for today:
    - birthdays     : Members whose birthday is today
    - expiring_soon : Active members expiring in next `expiry_days` days
    - inactive      : Active members absent for `inactive_days`+ days
    - overdue       : Members whose plan already expired (status=expired)
    """
    db = get_database()
    now_utc = datetime.now(timezone.utc)
    # India Standard Time (IST = UTC+05:30) is the primary operating timezone for gym reminders
    now_ist = now_utc + timedelta(hours=5, minutes=30)
    today_month = now_ist.month
    today_day   = now_ist.day

    # ── 1. Birthdays today ────────────────────────────────────────────────────
    # We store DOB or use joining_date — check for `date_of_birth` field first
    all_members = await db["members"].find({}).to_list(2000)

    birthday_members = []
    for m in all_members:
        dob = m.get("date_of_birth") or m.get("dob")
        if dob:
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

                if dob_month == today_month and dob_day == today_day:
                    birthday_members.append({
                        "_id":       str(m["_id"]),
                        "full_name": m.get("full_name", ""),
                        "phone":     m.get("phone", ""),
                        "category":  "birthday",
                        "label":     "🎂 Birthday Today",
                        "urgency":   "high",
                        "message_hint": f"Happy Birthday {m.get('full_name', '')}! 🎉 Wishing you a fantastic year ahead. We're glad to have you as part of our gym family! 💪",
                    })
            except Exception:
                pass

    # ── 2. Expiring Soon ──────────────────────────────────────────────────────
    expiry_until = now_utc + timedelta(days=expiry_days)
    expiring_cursor = db["members"].find({
        "status": "active",
        "next_due_date": {"$gte": now_utc, "$lte": expiry_until}
    }).sort("next_due_date", 1)
    expiring_list = await expiring_cursor.to_list(200)

    expiring_members = []
    for m in expiring_list:
        due = m.get("next_due_date")
        if due and due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        due_ist = due + timedelta(hours=5, minutes=30) if due else None
        days_left = (due_ist.date() - now_ist.date()).days if due_ist else 0
        urgency = "high" if days_left <= 2 else "medium" if days_left <= 4 else "low"
        expiring_members.append({
            "_id":          str(m["_id"]),
            "full_name":    m.get("full_name", ""),
            "phone":        m.get("phone", ""),
            "category":     "expiring",
            "label":        f"⏰ Expiring in {days_left} day{'s' if days_left != 1 else ''}",
            "days_left":    days_left,
            "next_due_date": due.isoformat() if due else None,
            "monthly_fees": m.get("monthly_fees", 0),
            "urgency":      urgency,
            "message_hint": f"Hi {m.get('full_name', '')}, your gym membership expires in {days_left} day{'s' if days_left != 1 else ''}! 🏋️ Renew now to continue your fitness journey without a break. Reply to confirm. 💪",
        })

    # ── 4. Overdue / Expired (status=expired OR next_due_date <= now) ─────────
    overdue_cursor = db["members"].find({
        "$or": [
            {"status": "expired"},
            {"next_due_date": {"$lte": now_utc}}
        ]
    }).sort("next_due_date", 1)
    overdue_list   = await overdue_cursor.to_list(500)

    overdue_members = []
    overdue_ids = set()
    for m in overdue_list:
        mid = str(m["_id"])
        if mid in overdue_ids:
            continue
        overdue_ids.add(mid)
        due = m.get("next_due_date")
        if due and isinstance(due, str):
            try:
                due = datetime.fromisoformat(due.replace("Z", "+00:00"))
            except:
                due = None
        if due and due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        due_ist = due + timedelta(hours=5, minutes=30) if due else None
        days_overdue = max(0, (now_ist.date() - due_ist.date()).days) if due_ist else 0
        is_today = (days_overdue == 0)
        overdue_members.append({
            "_id":           mid,
            "full_name":     m.get("full_name", ""),
            "phone":         m.get("phone", ""),
            "category":      "overdue",
            "label":         "❌ Expired Today" if is_today else f"❌ Expired {days_overdue}d ago",
            "days_overdue":  days_overdue,
            "monthly_fees":  m.get("monthly_fees", 0),
            "urgency":       "high" if days_overdue <= 7 else "medium",
            "message_hint":  f"Hi {m.get('full_name', '')}, your gym membership expired today! 🏋️ Renew today to keep your fitness streak alive! 💪 Contact us to renew." if is_today else f"Hi {m.get('full_name', '')}, your gym membership has expired. 😢 Renew today to get back on track and keep your fitness streak alive! 🏋️ Contact us to renew.",
        })

    # ── 3. Inactive Members (attendance disabled/removed from queue for now) ──
    inactive_members = []

    # ── Summary ───────────────────────────────────────────────────────────────
    total = len(birthday_members) + len(expiring_members) + len(overdue_members)

    return {
        "date": now_ist.date().isoformat(),
        "total": total,
        "summary": {
            "birthdays":     len(birthday_members),
            "expiring_soon": len(expiring_members),
            "inactive":      0,
            "overdue":       len(overdue_members),
        },
        "birthdays":     birthday_members,
        "expiring_soon": expiring_members,
        "inactive":      inactive_members,
        "overdue":       overdue_members,
    }
