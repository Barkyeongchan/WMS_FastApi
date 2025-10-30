from pydantic import BaseModel
from typing import Optional

class StockCreate(BaseModel):
    name: str
    quantity: int
    category_id: int
    pin_id: int

class StockUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    category_id: Optional[int] = None
    pin_id: Optional[int] = None

class StockResponse(BaseModel):
    id: int
    name: str
    quantity: int
    category_name: str
    pin_name: str

    class Config:
        from_attributes = True