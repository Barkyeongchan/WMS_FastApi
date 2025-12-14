from pydantic import BaseModel
from typing import Optional


# 로봇 기본 스키마
class RobotBase(BaseModel):
    name: str
    ip: str


# 로봇 생성 스키마
class RobotCreate(RobotBase):
    pass


# 로봇 수정 스키마
class RobotUpdate(BaseModel):
    name: Optional[str] = None
    ip: Optional[str] = None


# 로봇 응답 스키마
class RobotResponse(RobotBase):
    id: int

    class Config:
        orm_mode = True