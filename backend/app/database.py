import motor.motor_asyncio
import os
from dotenv import load_dotenv
import contextvars

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "whatasppmsg")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
super_admin_db = client[DATABASE_NAME]

# ContextVar to dynamically scope the database for a request context
tenant_db_var = contextvars.ContextVar("tenant_db", default=None)

def get_database(tenant_id: str = None):
    """
    Returns the appropriate database connection.
    If a specific tenant_id is provided, returns the tenant-specific database.
    If a database is set in the current context variable (set by middleware), returns that.
    Otherwise, falls back to the main super admin database.
    """
    if tenant_id:
        return client[f"gym_{tenant_id}"]
        
    current_db = tenant_db_var.get()
    if current_db is not None:
        return current_db
        
    return super_admin_db

