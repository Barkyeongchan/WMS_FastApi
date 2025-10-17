from sqlalchemy.orm import Session
from app.crud import pin_crud
from app.models.pin import Pin

class PinService:

    def __init__(self, db: Session):
        self.db = db

    # CREATE 핀 추가
    def create_pin(self, name: str, coords: str, category: str):
        pin = Pin(name=name, coords=coords, category=category)
        return pin_crud.create_pin(self.db, pin)

    # READ 핀 목록 조회
    def list_pins(self, skip: int = 0, limit: int = 100):
        return pin_crud.get_pins(self.db, skip, limit)