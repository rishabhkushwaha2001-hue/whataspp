import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# Ensure the 'app' directory is in the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.members import router as members_router
from api.messages import router as messages_router
from api.settings import router as settings_router
from api.super_admin import router as super_admin_router
from api.auth import router as auth_router
from database import client, tenant_db_var

app = FastAPI(title="WhatsApp Gym Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Multi-tenant middleware to scope database context per-request
@app.middleware("http")
async def tenant_middleware(request, call_next):
    x_tenant_id = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID")
    token = None
    if x_tenant_id:
        tenant_db = client[f"gym_{x_tenant_id}"]
        token = tenant_db_var.set(tenant_db)
        
    try:
        response = await call_next(request)
        return response
    finally:
        if token:
            tenant_db_var.reset(token)

@app.on_event("startup")
async def startup_db_client():
    # Ping the database to ensure connection
    try:
        await client.admin.command('ping')
        print("Connected successfully to MongoDB")
    except Exception as e:
        print(f"Could not connect to MongoDB: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    print("Closed MongoDB connection")

# Include API Routers
app.include_router(members_router, prefix="/api/v1/members", tags=["members"])
app.include_router(messages_router, prefix="/api/v1/messages", tags=["messages"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(super_admin_router, prefix="/api/v1/super-admin", tags=["super-admin"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

@app.get("/")
async def root():
    return {"message": "WhatsApp Gym Management API is running"}

