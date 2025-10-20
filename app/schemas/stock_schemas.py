# app/schemas/stock_schema.py
from pydantic import BaseModel

class StockBase(BaseModel):
    name: str
    category: str
    pin: str
    quantity: int

class StockCreate(StockBase):
    pass

class StockUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    pin: str | None = None
    quantity: int | None = None

class StockResponse(StockBase):
    id: int

    class Config:
        orm_mode = True