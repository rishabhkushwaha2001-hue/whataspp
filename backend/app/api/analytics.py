from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from database import get_database

router = APIRouter()


# ─────────────────────────────────────────
# 1. STATUS COUNTS  (Members tab grid)
# ─────────────────────────────────────────
@router.get("/status-counts", response_model=Dict[str, int])
async def get_status_counts():
    """Active / Inactive / Expired / Expiring-soon counts."""
    db = get_database()
    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=7)

    # Sync any active member whose due date has passed to 'expired'
    await db["members"].update_many(
        {"status": "active", "next_due_date": {"$ne": None, "$lt": now}},
        {"$set": {"status": "expired"}}
    )

    expired  = await db["members"].count_documents({
        "$or": [
            {"status": "expired"},
            {"status": {"$ne": "inactive"}, "next_due_date": {"$ne": None, "$lt": now}}
        ]
    })
    active   = await db["members"].count_documents({
        "status": "active",
        "$or": [
            {"next_due_date": None},
            {"next_due_date": {"$gte": now}}
        ]
    })
    inactive = await db["members"].count_documents({"status": "inactive"})
    expiring = await db["members"].count_documents({
        "status": "active",
        "next_due_date": {"$ne": None, "$gte": now, "$lte": soon}
    })

    return {"active": active, "inactive": inactive, "expired": expired, "expiring_soon": expiring}


# ─────────────────────────────────────────
# 2. OVERVIEW SUMMARY  (hero KPI cards)
# ─────────────────────────────────────────
@router.get("/summary")
async def get_summary():
    """Current-month KPIs vs previous month."""
    db = get_database()
    now = datetime.now(timezone.utc)

    cur_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_end   = cur_start
    prev_start = (cur_start - timedelta(days=1)).replace(day=1)

    # Revenue this month
    cur_payments = await db["payments"].find(
        {"payment_date": {"$gte": cur_start, "$lt": now}}
    ).to_list(5000)
    cur_revenue = sum(float(p.get("amount", 0)) for p in cur_payments)

    # Revenue prev month
    prev_payments = await db["payments"].find(
        {"payment_date": {"$gte": prev_start, "$lt": prev_end}}
    ).to_list(5000)
    prev_revenue = sum(float(p.get("amount", 0)) for p in prev_payments)

    rev_change = 0
    if prev_revenue > 0:
        rev_change = round(((cur_revenue - prev_revenue) / prev_revenue) * 100, 1)

    # New members this month
    new_members = await db["members"].count_documents(
        {"created_at": {"$gte": cur_start}}
    )
    prev_new = await db["members"].count_documents(
        {"created_at": {"$gte": prev_start, "$lt": prev_end}}
    )

    # Active members now
    active_now = await db["members"].count_documents({"status": "active"})

    # Total members
    total = await db["members"].count_documents({})

    # Expenses this month
    expenses = await db["expenses"].find(
        {"date": {"$gte": cur_start, "$lt": now}}
    ).to_list(1000)
    cur_expense = sum(float(e.get("amount", 0)) for e in expenses)

    net_profit = cur_revenue - cur_expense

    return {
        "cur_revenue": cur_revenue,
        "prev_revenue": prev_revenue,
        "rev_change_pct": rev_change,
        "new_members": new_members,
        "prev_new_members": prev_new,
        "active_members": active_now,
        "total_members": total,
        "cur_expense": cur_expense,
        "net_profit": net_profit,
    }


# ─────────────────────────────────────────
# 3. DAILY / CUSTOM REVENUE + MEMBER NAMES
# ─────────────────────────────────────────
@router.get("/revenue/daily")
async def get_daily_revenue(
    month: str = None,
    start_date: str = None,
    end_date: str = None,
):
    """Payments for a month (YYYY-MM) OR a custom date range (YYYY-MM-DD to YYYY-MM-DD)."""
    db = get_database()

    if start_date and end_date:
        try:
            s = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            e = datetime.strptime(end_date,   "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            raise HTTPException(400, "Use YYYY-MM-DD format")
    elif month:
        try:
            s = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
            e = s.replace(month=s.month + 1) if s.month < 12 else s.replace(year=s.year + 1, month=1)
        except ValueError:
            raise HTTPException(400, "Use YYYY-MM format")
    else:
        raise HTTPException(400, "Provide month or start_date & end_date")

    pipeline = [
        {"$match": {"payment_date": {"$gte": s, "$lt": e}}},
        {"$addFields": {"member_obj_id": {"$toObjectId": "$member_id"}}},
        {"$lookup": {"from": "members", "localField": "member_obj_id",
                     "foreignField": "_id", "as": "mi"}},
        {"$unwind": {"path": "$mi", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": {"$toString": "$_id"},
            "amount": 1, "payment_date": 1, "payment_method": 1,
            "member_name":  {"$ifNull": ["$mi.full_name", "Unknown"]},
            "member_phone": {"$ifNull": ["$mi.phone", ""]},
        }},
        {"$sort": {"payment_date": -1}},
    ]
    results = await db["payments"].aggregate(pipeline).to_list(1000)
    return results


# ─────────────────────────────────────────
# 4. MONTHLY REVENUE (yearly bar chart)
# ─────────────────────────────────────────
@router.get("/revenue/monthly")
async def get_monthly_revenue(year: int):
    db = get_database()
    s = datetime(year, 1, 1, tzinfo=timezone.utc)
    e = datetime(year + 1, 1, 1, tzinfo=timezone.utc)

    pipeline = [
        {"$match": {"payment_date": {"$gte": s, "$lt": e}}},
        {"$group": {"_id": {"$month": "$payment_date"}, "total": {"$sum": "$amount"}}},
    ]
    rows = await db["payments"].aggregate(pipeline).to_list(12)
    monthly = [{"month": i, "total": 0} for i in range(1, 13)]
    for r in rows:
        monthly[r["_id"] - 1]["total"] = r["total"]
    return monthly


# ─────────────────────────────────────────
# 5. PAYMENT METHOD BREAKDOWN  (pie chart)
# ─────────────────────────────────────────
@router.get("/payment-methods")
async def get_payment_methods(month: str = None):
    """Cash / UPI / Online split for a given month (defaults to current)."""
    db = get_database()
    now = datetime.now(timezone.utc)
    if month:
        try:
            s = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
            e = s.replace(month=s.month + 1) if s.month < 12 else s.replace(year=s.year + 1, month=1)
        except ValueError:
            raise HTTPException(400, "Use YYYY-MM")
    else:
        s = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now

    pipeline = [
        {"$match": {"payment_date": {"$gte": s, "$lt": e}}},
        {"$group": {
            "_id": {"$ifNull": ["$payment_method", "Cash"]},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]
    rows = await db["payments"].aggregate(pipeline).to_list(20)
    return [{"method": r["_id"], "total": r["total"], "count": r["count"]} for r in rows]


# ─────────────────────────────────────────
# 6. MEMBER GROWTH (new vs renewal per month)
# ─────────────────────────────────────────
@router.get("/member-growth")
async def get_member_growth(year: int = None):
    db = get_database()
    now = datetime.now(timezone.utc)
    yr  = year or now.year
    s   = datetime(yr, 1, 1, tzinfo=timezone.utc)
    e   = datetime(yr + 1, 1, 1, tzinfo=timezone.utc)

    pipeline = [
        {"$match": {"created_at": {"$gte": s, "$lt": e}}},
        {"$group": {
            "_id": {
                "month": {"$month": "$created_at"},
                "category": {"$ifNull": ["$category", "New"]},
            },
            "count": {"$sum": 1},
        }},
    ]
    rows = await db["members"].aggregate(pipeline).to_list(100)

    monthly: Dict[int, Dict] = {i: {"month": i, "new": 0, "renewal": 0} for i in range(1, 13)}
    for r in rows:
        m = r["_id"]["month"]
        cat = (r["_id"]["category"] or "New").lower()
        if "renewal" in cat:
            monthly[m]["renewal"] += r["count"]
        else:
            monthly[m]["new"] += r["count"]

    return list(monthly.values())


# ─────────────────────────────────────────
# 7. EXPIRY ALERTS
# ─────────────────────────────────────────
@router.get("/expiry-alerts")
async def get_expiry_alerts(days: int = 30):
    """Members whose subscription expires within `days` days or is already expired."""
    db = get_database()
    now = datetime.now(timezone.utc)
    until = now + timedelta(days=days)
    IST = timezone(timedelta(hours=5, minutes=30))
    today_ist = datetime.now(IST).date()

    cursor = db["members"].find(
        {
            "status": {"$in": ["active", "expired"]},
            "next_due_date": {"$ne": None, "$lte": until}
        }
    ).sort("next_due_date", 1)
    members = await cursor.to_list(200)

    result = []
    for m in members:
        due = m.get("next_due_date")
        if due:
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            due_ist_date = due.astimezone(IST).date()
            days_left = (due_ist_date - today_ist).days
        else:
            days_left = 0
        result.append({
            "_id": str(m["_id"]),
            "full_name": m.get("full_name", ""),
            "phone": m.get("phone", ""),
            "next_due_date": due.isoformat() if due else None,
            "days_left": days_left,
            "monthly_fees": m.get("monthly_fees", 0),
        })
    return result


# ─────────────────────────────────────────
# 8. ATTENDANCE STATS (daily visit counts)
# ─────────────────────────────────────────
@router.get("/attendance-stats")
async def get_attendance_stats(month: str = None):
    """Daily attendance count for a given month."""
    db = get_database()
    now = datetime.now(timezone.utc)
    if month:
        try:
            s = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
            e = s.replace(month=s.month + 1) if s.month < 12 else s.replace(year=s.year + 1, month=1)
        except ValueError:
            raise HTTPException(400, "Use YYYY-MM")
    else:
        s = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now

    pipeline = [
        {"$match": {"check_in_time": {"$gte": s, "$lt": e}}},
        {"$group": {
            "_id": {
                "$dateToString": {"format": "%Y-%m-%d", "date": "$check_in_time", "timezone": "+05:30"}
            },
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db["attendance"].aggregate(pipeline).to_list(31)
    return [{"date": r["_id"], "count": r["count"]} for r in rows]


# ─────────────────────────────────────────
# 9. PLAN BREAKDOWN (revenue by plan duration)
# ─────────────────────────────────────────
@router.get("/plan-breakdown")
async def get_plan_breakdown(month: str = None):
    """Revenue split by plan duration (1 mo, 3 mo, 6 mo, etc.)."""
    db = get_database()
    now = datetime.now(timezone.utc)
    if month:
        try:
            s = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
            e = s.replace(month=s.month + 1) if s.month < 12 else s.replace(year=s.year + 1, month=1)
        except ValueError:
            raise HTTPException(400, "Use YYYY-MM")
    else:
        s = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        e = now

    pipeline = [
        {"$match": {"payment_date": {"$gte": s, "$lt": e}}},
        {"$group": {
            "_id": {"$ifNull": ["$plan_duration", 1]},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db["payments"].aggregate(pipeline).to_list(20)
    return [{"plan_months": r["_id"], "total": r["total"], "count": r["count"]} for r in rows]


# ─────────────────────────────────────────
# 10. PROFIT & LOSS (revenue vs expenses)
# ─────────────────────────────────────────
@router.get("/profit-loss")
async def get_profit_loss(year: int = None):
    """Monthly revenue vs expenses for a year (defaults to current year)."""
    db = get_database()
    yr = year or datetime.now(timezone.utc).year
    s  = datetime(yr, 1, 1, tzinfo=timezone.utc)
    e  = datetime(yr + 1, 1, 1, tzinfo=timezone.utc)

    rev_pipeline = [
        {"$match": {"payment_date": {"$gte": s, "$lt": e}}},
        {"$group": {"_id": {"$month": "$payment_date"}, "revenue": {"$sum": "$amount"}}},
    ]
    exp_pipeline = [
        {"$match": {"date": {"$gte": s, "$lt": e}}},
        {"$group": {"_id": {"$month": "$date"}, "expense": {"$sum": "$amount"}}},
    ]

    rev_rows = {r["_id"]: r["revenue"] for r in await db["payments"].aggregate(rev_pipeline).to_list(12)}
    exp_rows = {r["_id"]: r["expense"] for r in await db["expenses"].aggregate(exp_pipeline).to_list(12)}

    result = []
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    for i in range(1, 13):
        rev = rev_rows.get(i, 0)
        exp = exp_rows.get(i, 0)
        result.append({
            "month": i,
            "label": month_names[i - 1],
            "revenue": rev,
            "expense": exp,
            "profit": rev - exp,
        })
    return result


# ─────────────────────────────────────────
# 11. SMART AI INSIGHTS  (gym intelligence)
# ─────────────────────────────────────────
@router.get("/insights")
async def get_insights():
    """
    Smart gym intelligence:
    - Gym Health Score (0–100)
    - AI-generated insight cards with severity
    - Churn-risk members (active but absent 30+ days)
    - Revenue forecast for current month
    - Top stats (best month, peak day, popular plan)
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    # ── Basic counts ──────────────────────────────────────────────────────────
    total   = await db["members"].count_documents({})
    active  = await db["members"].count_documents({"status": "active"})
    expired = await db["members"].count_documents({"status": "expired"})
    inactive= await db["members"].count_documents({"status": "inactive"})

    # ── Current & previous month revenue ─────────────────────────────────────
    cur_start  = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_end   = cur_start
    prev_start = (cur_start - timedelta(days=1)).replace(day=1)

    cur_payments  = await db["payments"].find({"payment_date": {"$gte": cur_start, "$lt": now}}).to_list(5000)
    prev_payments = await db["payments"].find({"payment_date": {"$gte": prev_start, "$lt": prev_end}}).to_list(5000)
    cur_rev  = sum(float(p.get("amount", 0)) for p in cur_payments)
    prev_rev = sum(float(p.get("amount", 0)) for p in prev_payments)

    # ── Revenue forecast (linear extrapolation) ───────────────────────────────
    days_passed = max((now - cur_start).days, 1)
    import calendar
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    forecast = (cur_rev / days_passed) * days_in_month if days_passed > 0 else 0

    # ── Expiring soon (7 days) ────────────────────────────────────────────────
    soon = now + timedelta(days=7)
    expiring_soon = await db["members"].count_documents(
        {"status": "active", "next_due_date": {"$gte": now, "$lte": soon}}
    )

    # ── Churn risk: active but absent 30+ days ────────────────────────────────
    thirty_days_ago = now - timedelta(days=30)
    active_members  = await db["members"].find({"status": "active"}).to_list(1000)

    churn_risk = []
    for m in active_members:
        mid = str(m.get("member_id") or m.get("_id", ""))
        last_att = await db["attendance"].find_one(
            {"member_id": {"$in": [mid, m.get("member_id")]}},
            sort=[("check_in_time", -1)]
        )
        if not last_att or last_att.get("check_in_time", now) < thirty_days_ago:
            last_seen = last_att.get("check_in_time") if last_att else None
            days_absent = (now - last_seen).days if last_seen else None
            churn_risk.append({
                "_id": str(m["_id"]),
                "full_name": m.get("full_name", ""),
                "phone": m.get("phone", ""),
                "days_absent": days_absent,
                "next_due_date": m.get("next_due_date").isoformat() if m.get("next_due_date") else None,
            })
    churn_risk = churn_risk[:20]  # top 20

    # ── Best month this year ──────────────────────────────────────────────────
    yr_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    yr_end   = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    yr_pipeline = [
        {"$match": {"payment_date": {"$gte": yr_start, "$lt": yr_end}}},
        {"$group": {"_id": {"$month": "$payment_date"}, "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
    ]
    yr_rows = await db["payments"].aggregate(yr_pipeline).to_list(12)
    best_month = None
    if yr_rows:
        bm = yr_rows[0]
        best_month = {"month": month_names[bm["_id"] - 1], "total": bm["total"]}

    # ── Peak attendance day (last 30 days) ────────────────────────────────────
    att_pipeline = [
        {"$match": {"check_in_time": {"$gte": thirty_days_ago, "$lt": now}}},
        {"$group": {"_id": {"$dayOfWeek": "$check_in_time"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    att_rows = await db["attendance"].aggregate(att_pipeline).to_list(7)
    day_names = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    peak_day = None
    if att_rows:
        peak_day = {"day": day_names[att_rows[0]["_id"]], "count": att_rows[0]["count"]}

    # ── Most popular plan ─────────────────────────────────────────────────────
    plan_pipeline = [
        {"$match": {"payment_date": {"$gte": yr_start, "$lt": yr_end}}},
        {"$group": {"_id": {"$ifNull": ["$plan_duration", 1]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    plan_rows = await db["payments"].aggregate(plan_pipeline).to_list(10)
    popular_plan = None
    if plan_rows:
        p = plan_rows[0]
        popular_plan = {"months": p["_id"], "count": p["count"]}

    # ── Gym Health Score ─────────────────────────────────────────────────────
    # Components: active_ratio (40pts) + revenue_growth (30pts) + attendance (20pts) + low_churn (10pts)
    active_ratio = (active / total * 100) if total > 0 else 0
    active_score = min(active_ratio * 0.4, 40)                             # max 40

    rev_growth   = ((cur_rev - prev_rev) / prev_rev * 100) if prev_rev > 0 else 0
    rev_score    = min(max((rev_growth + 20) * 0.75, 0), 30)              # max 30

    att_total    = sum(r["count"] for r in att_rows)
    att_score    = min(att_total / 3, 20)                                  # 60 visits/month = 20pts

    churn_ratio  = len(churn_risk) / active if active > 0 else 1
    churn_score  = max(10 - churn_ratio * 10, 0)                          # max 10

    health_score = round(active_score + rev_score + att_score + churn_score)

    # ── Generate insight cards ────────────────────────────────────────────────
    insights = []

    # Revenue insight
    if rev_growth > 10:
        insights.append({"type": "success", "icon": "line-chart",
            "title": "Revenue Growing 🎉",
            "message": f"Revenue is up {rev_growth:.1f}% vs last month. Keep it up!"})
    elif rev_growth < -10:
        insights.append({"type": "warning", "icon": "arrow-down",
            "title": "Revenue Dropped ⚠️",
            "message": f"Revenue fell {abs(rev_growth):.1f}% vs last month. Consider running a promotion."})
    else:
        insights.append({"type": "info", "icon": "minus",
            "title": "Revenue Stable",
            "message": f"Revenue is stable this month (₹{cur_rev:,.0f})."})

    # Forecast
    if forecast > 0:
        insights.append({"type": "info", "icon": "calculator",
            "title": "Month-End Forecast 📈",
            "message": f"At current rate, you'll collect ₹{forecast:,.0f} by end of {month_names[now.month-1]}."})

    # Expiry alert
    if expiring_soon > 0:
        insights.append({"type": "warning", "icon": "clock-o",
            "title": f"{expiring_soon} Members Expiring This Week ⏰",
            "message": "Send renewal reminders now to retain them. Early reminders improve renewal rate by 40%."})

    # Churn risk
    if len(churn_risk) > 5:
        insights.append({"type": "danger", "icon": "user-times",
            "title": f"{len(churn_risk)} Members Not Visiting 🚨",
            "message": f"{len(churn_risk)} active members haven't attended in 30+ days. High churn risk!"})
    elif len(churn_risk) > 0:
        insights.append({"type": "warning", "icon": "user-times",
            "title": f"{len(churn_risk)} Members Inactive",
            "message": "Some active members haven't visited recently. Consider sending a check-in message."})

    # Active ratio
    if active_ratio > 70:
        insights.append({"type": "success", "icon": "check-circle",
            "title": "Great Active Rate! 💪",
            "message": f"{active_ratio:.0f}% of your members are currently active. Excellent retention!"})
    elif active_ratio < 40:
        insights.append({"type": "danger", "icon": "exclamation-circle",
            "title": "Low Active Rate ❌",
            "message": f"Only {active_ratio:.0f}% members are active. Focus on re-engagement campaigns."})

    # Peak day tip
    if peak_day:
        insights.append({"type": "tip", "icon": "calendar",
            "title": f"Peak Day: {peak_day['day']} 🏋️",
            "message": f"Most members visit on {peak_day['day']}. Schedule extra staff or classes on that day."})

    return {
        "health_score": health_score,
        "insights": insights,
        "churn_risk": churn_risk,
        "forecast": round(forecast),
        "best_month": best_month,
        "peak_day": peak_day,
        "popular_plan": popular_plan,
        "stats": {
            "active_ratio": round(active_ratio, 1),
            "rev_growth_pct": round(rev_growth, 1),
            "cur_revenue": round(cur_rev),
            "forecast": round(forecast),
        }
    }
