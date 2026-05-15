import uvicorn
import os

if __name__ == "__main__":
    # Use PORT from environment (Render) or default to 8000
    port = int(os.environ.get("PORT", 8000))
    
    # Security: Disable reload in production (if ENV is set to production)
    is_dev = os.environ.get("ENV", "development") == "development"
    
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=port, 
        reload=is_dev
    )
