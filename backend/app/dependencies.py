from fastapi import Header, HTTPException, Depends
from database import get_database

async def get_tenant_db(x_tenant_id: str = Header(None)):
    """
    Dependency to get the database for a specific tenant.
    Reads X-Tenant-ID from headers.
    """
    if not x_tenant_id:
        # For development or public routes, you might allow a default
        # But for production multi-tenancy, it should be required
        return get_database()
    
    return get_database(tenant_id=x_tenant_id)
