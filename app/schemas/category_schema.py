from pydantic import BaseModel
from typing import Optional

# 기본 스키마
class CategoryBase(BaseModel):
    name: str

# 생성용 스키마
class CategoryCreate(CategoryBase):
    pass

# 수정용 스키마
class CategoryUpdate(BaseModel):
    name: Optional[str] = None

# 응답용 스키마
class CategoryResponse(CategoryBase):
    id: int

    class Config:
        orm_mode = True