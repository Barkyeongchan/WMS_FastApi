from typing import Optional
from sqlalchemy.orm import Session
from app.crud import pin_crud
from app.models.pin_model import Pin

class PinService:
    def __init__(self, db: Session):
        self.db = db

    # CREATE 핀 생성
    def create_pin(self, name: str, coords: Optional[str] = None):
        pin = Pin(name=name, coords=coords)
        return pin_crud.create_pin(self.db, pin)

    # READ 전체 핀 조회
    def list_pins(self, skip: int = 0, limit: int = 100):
        return pin_crud.get_pins(self.db, skip, limit)