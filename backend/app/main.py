import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# Ensure the 'app' directory is in the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.members import router as members_router
from api.messages import router as messages_router
from api.settings import router as settings_router
from database import client

app = FastAPI(title="WhatsApp Gym Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

app.include_router(members_router, prefix="/api/v1/members", tags=["members"])
app.include_router(messages_router, prefix="/api/v1/messages", tags=["messages"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["settings"])

@app.get("/")
async def root():
    return {"message": "WhatsApp Gym Management API is running"}
