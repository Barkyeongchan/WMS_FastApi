from pydantic import BaseModel
from typing import Optional


# 핀 기본 스키마
class PinBase(BaseModel):
    name: str
    coords: Optional[str] = None


# 핀 생성 스키마
class PinCreate(PinBase):
    pass


# 핀 수정 스키마
class PinUpdate(BaseModel):
    name: Optional[str] = None
    coords: Optional[str] = None


# 핀 응답 스키마
class PinResponse(PinBase):
    id: int

    class Config:
        orm_mode = True