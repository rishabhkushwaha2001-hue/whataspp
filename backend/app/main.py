from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import members, messages

app = FastAPI(title="WhatsApp Gym Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(members.router, prefix="/api/v1/members", tags=["members"])
app.include_router(messages.router, prefix="/api/v1/messages", tags=["messages"])

@app.get("/")
async def root():
    return {"message": "WhatsApp Gym Management API is running"}
