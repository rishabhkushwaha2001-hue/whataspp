import sys
import os
import asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# Ensure the 'app' directory is in the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.members import router as members_router
from api.messages import router as messages_router
from api.settings import router as settings_router
from api.plans import router as plans_router
from api.super_admin import router as super_admin_router
from api.auth import router as auth_router
from api.seats import router as seats_router
from api.feedback import router as feedback_router
from api.attendance import router as attendance_router
from api.student_auth import router as student_auth_router
from database import client, tenant_db_var, super_admin_db
from fastapi.responses import JSONResponse
from datetime import datetime, timezone

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
    
    # Skip tenant validation for auth routes to allow login even with stale tenant IDs
    is_auth_route = request.url.path.startswith("/api/v1/auth")
    
    # If a tenant header is provided and it is not the super admin, verify the status of this tenant
    if x_tenant_id and x_tenant_id != "super_admin" and not is_auth_route:
        try:
            gym = await super_admin_db["gyms"].find_one({"gym_id": x_tenant_id})
            if not gym:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Your gym account has been deleted. Please contact Super Admin."}
                )
            
            if gym.get("status") in ["inactive", "suspended"]:
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"Your gym account is currently {gym.get('status')}. Please contact Super Admin."}
                )
                
            # Check Plan Expiry
            now = datetime.now(timezone.utc)
            expiry = gym.get("plan_expiry")
            if expiry:
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                if expiry < now:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Your subscription plan has expired! Please contact Super Admin for renewal."}
                    )
        except Exception as e:
            print(f"Error in tenant verification middleware: {e}")

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
        
    # Start the keep-alive background task
    asyncio.create_task(keep_alive_task())

async def keep_alive_task():
    url = "https://whataspp-0u22.onrender.com/"
    while True:
        try:
            async with httpx.AsyncClient() as http_client:
                await http_client.get(url)
                print(f"Keep-alive ping sent to {url} to prevent Render from sleeping")
        except Exception as e:
            print(f"Keep-alive ping failed: {e}")
        # Wait for 14 minutes (840 seconds)
        await asyncio.sleep(840)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    print("Closed MongoDB connection")

# Include API Routers
app.include_router(members_router, prefix="/api/v1/members", tags=["members"])
app.include_router(messages_router, prefix="/api/v1/messages", tags=["messages"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(plans_router, prefix="/api/v1/plans", tags=["plans"])
app.include_router(super_admin_router, prefix="/api/v1/super-admin", tags=["super-admin"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(seats_router, prefix="/api/v1/seats", tags=["seats"])
app.include_router(feedback_router, prefix="/api/v1/feedback", tags=["feedback"])
app.include_router(attendance_router, prefix="/api/v1/attendance", tags=["attendance"])
app.include_router(student_auth_router, prefix="/api/v1/student", tags=["student"])

@app.get("/")
async def root():
    return {"message": "WhatsApp Gym Management API is running"}

