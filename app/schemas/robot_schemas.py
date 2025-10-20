# app/schemas/robot_schema.py
from pydantic import BaseModel

class RobotBase(BaseModel):
    name: str
    ip: str

class RobotCreate(RobotBase):
    pass

class RobotUpdate(BaseModel):
    name: str | None = None
    ip: str | None = None

class RobotResponse(RobotBase):
    id: int

    class Config:
        orm_mode = True