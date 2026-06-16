from fastapi import APIRouter, HTTPException, Query, status
from bson import ObjectId
from typing import Any, List
from datetime import datetime, timezone
from database import get_database
from models.schemas import ExpenseCreate, ExpenseInDB

router = APIRouter()

# ----------------------------
# Expense Categories
# ----------------------------

@router.get("/categories")
async def get_expense_categories() -> List[str]:
    db = get_database()
    settings = await db["settings"].find_one({"type": "expense_categories"})
    if settings and "categories" in settings:
        return settings["categories"]
    
    # Default categories if none exist
    default_categories = ["Rent", "Electricity", "Water", "Maintenance", "Salary", "Equipment", "Supplies", "Other"]
    await db["settings"].update_one(
        {"type": "expense_categories"},
        {"$set": {"categories": default_categories}},
        upsert=True
    )
    return default_categories

@router.post("/categories")
async def add_expense_category(category: str = Query(...)) -> Any:
    category = category.strip()
    if not category:
        raise HTTPException(status_code=400, detail="Category name cannot be empty")
        
    db = get_database()
    settings = await db["settings"].find_one({"type": "expense_categories"})
    categories = settings.get("categories", []) if settings else []
    
    if category in categories:
        raise HTTPException(status_code=400, detail="Category already exists")
        
    categories.append(category)
    await db["settings"].update_one(
        {"type": "expense_categories"},
        {"$set": {"categories": categories}},
        upsert=True
    )
    return {"message": "Category added successfully", "categories": categories}

@router.delete("/categories/{category}")
async def delete_expense_category(category: str) -> Any:
    db = get_database()
    settings = await db["settings"].find_one({"type": "expense_categories"})
    categories = settings.get("categories", []) if settings else []
    
    if category not in categories:
        raise HTTPException(status_code=404, detail="Category not found")
        
    categories.remove(category)
    await db["settings"].update_one(
        {"type": "expense_categories"},
        {"$set": {"categories": categories}},
        upsert=True
    )
    return {"message": "Category deleted successfully", "categories": categories}

# ----------------------------
# Expenses CRUD
# ----------------------------

@router.post("/", response_model=ExpenseInDB)
async def create_expense(expense_in: ExpenseCreate) -> Any:
    db = get_database()
    expense_dict = expense_in.dict()
    
    if expense_dict["date"].tzinfo is None:
        expense_dict["date"] = expense_dict["date"].replace(tzinfo=timezone.utc)
        
    result = await db["expenses"].insert_one(expense_dict)
    
    created = await db["expenses"].find_one({"_id": result.inserted_id})
    created["_id"] = str(created["_id"])
    return created

@router.get("/", response_model=List[ExpenseInDB])
async def get_expenses(month: int = Query(None), year: int = Query(None)) -> Any:
    db = get_database()
    query = {}
    
    if month and year:
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        query["date"] = {"$gte": start_date, "$lt": end_date}
        
    cursor = db["expenses"].find(query).sort("date", -1)
    expenses = await cursor.to_list(length=1000)
    for e in expenses:
        e["_id"] = str(e["_id"])
    return expenses

@router.delete("/{expense_id}")
async def delete_expense(expense_id: str) -> Any:
    db = get_database()
    try:
        obj_id = ObjectId(expense_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid expense ID")
        
    result = await db["expenses"].delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    return {"message": "Expense deleted successfully"}
