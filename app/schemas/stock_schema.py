from pydantic import BaseModel
from typing import Optional


# 재고 생성 스키마
class StockCreate(BaseModel):
    name: str
    quantity: int
    category_id: int
    pin_id: int


# 재고 수정 스키마
class StockUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    category_id: Optional[int] = None
    pin_id: Optional[int] = None


# 재고 응답 스키마
class StockResponse(BaseModel):
    id: int
    name: str
    quantity: int
    category_name: str
    pin_name: str

    class Config:
        from_attributes = True