# app/schemas/pin_schema.py
from pydantic import BaseModel
from typing import Optional

class PinBase(BaseModel):
    name: str
    coords: Optional[str] = None

class PinCreate(PinBase):
    pass

class PinUpdate(BaseModel):
    name: Optional[str] = None
    coords: Optional[str] = None

class PinResponse(PinBase):
    id: int

    class Config:
        orm_mode = True