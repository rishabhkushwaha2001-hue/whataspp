import motor.motor_asyncio
import os
from dotenv import load_dotenv
import contextvars
import asyncio

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "whatasppmsg")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
super_admin_db = client[DATABASE_NAME]

# ContextVar to dynamically scope the database for a request context
tenant_db_var = contextvars.ContextVar("tenant_db", default=None)

initialized_dbs = set()

async def create_indexes_async(db):
    db_name = db.name
    if db_name in initialized_dbs:
        return
    try:
        print(f"Creating indexes for database: {db_name}")
        if db_name == DATABASE_NAME:
            # super admin
            await db["gyms"].create_index("gym_id", unique=True)
            await db["gyms"].create_index("phone")
        else:
            # tenant database
            # members indexes
            await db["members"].create_index("member_id", unique=True, sparse=True)
            await db["members"].create_index("phone")
            await db["members"].create_index([("status", 1), ("next_due_date", 1)])
            await db["members"].create_index("created_at")
            await db["members"].create_index("joining_date")
            await db["members"].create_index("allocated_seat")
            
            # payments indexes
            await db["payments"].create_index("payment_date")
            await db["payments"].create_index("member_id")
            await db["payments"].create_index([("start_date", 1), ("type", 1)])
            
            # attendance indexes
            await db["attendance"].create_index("check_in_time")
            await db["attendance"].create_index("member_id")
            await db["attendance"].create_index([("member_id", 1), ("check_in_time", -1)])
            
            # messages indexes
            await db["messages"].create_index("sent_at")
            await db["messages"].create_index("recipient_phone")
            
            # expenses indexes
            await db["expenses"].create_index("date")
            
            # seats indexes
            await db["seats"].create_index("seat_number", unique=True)
            await db["seats"].create_index("status")
            await db["seats"].create_index("member_id")
            
        initialized_dbs.add(db_name)
        print(f"Successfully initialized indexes for database: {db_name}")
    except Exception as e:
        print(f"Error creating indexes for {db_name}: {e}")

def get_database(tenant_id: str = None):
    """
    Returns the appropriate database connection.
    If a specific tenant_id is provided, returns the tenant-specific database.
    If a database is set in the current context variable (set by middleware), returns that.
    Otherwise, falls back to the main super admin database.
    """
    if tenant_id:
        db = client[f"gym_{tenant_id}"]
    else:
        current_db = tenant_db_var.get()
        if current_db is not None:
            db = current_db
        else:
            db = super_admin_db
            
    # Trigger index creation asynchronously if not already done
    db_name = db.name
    if db_name not in initialized_dbs:
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(create_indexes_async(db))
        except RuntimeError:
            # Fallback if called outside a running event loop (e.g. CLI script)
            pass
            
    return db


