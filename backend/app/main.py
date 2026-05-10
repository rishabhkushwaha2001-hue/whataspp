from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.members import router as members_router
from .api.messages import router as messages_router

app = FastAPI(title="WhatsApp Gym Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(members_router, prefix="/api/v1/members", tags=["members"])
app.include_router(messages_router, prefix="/api/v1/messages", tags=["messages"])

@app.get("/")
async def root():
    return {"message": "WhatsApp Gym Management API is running"}
