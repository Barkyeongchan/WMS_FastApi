from pydantic import BaseModel
from typing import Optional

class RobotBase(BaseModel):
    name: str
    ip: str

class RobotCreate(RobotBase):
    pass

class RobotUpdate(BaseModel):
    name: Optional[str] = None
    ip: Optional[str] = None

class RobotResponse(RobotBase):
    id: int

    class Config:
        orm_mode = True