from sqlalchemy.orm import Session
from app.models.pin import Pin

# CREATE 새로운 핀 데이터 추가
def create_pin(db: Session, pin_data: dict):
    pin = Pin(**pin_data)
    db.add(pin)
    db.commit()
    db.refresh(pin)
    return pin


# READ 특정 핀 ID로 조회
def get_pin(db: Session, pin_id: int):
    return db.query(Pin).filter(Pin.id == pin_id).first()


# READ-ALL 전체 핀 또는 일부 목록 조회
def get_pins(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Pin).offset(skip).limit(limit).all()


# UPDATE 핀 데이터 수정
def update_pin(db: Session, pin_id: int, update_data: dict):
    pin = db.query(Pin).filter(Pin.id == pin_id).first()
    if not pin:
        return None

    for key, value in update_data.items():
        setattr(pin, key, value)

    db.commit()
    db.refresh(pin)
    return pin


# DELETE 핀 데이터 삭제
def delete_pin(db: Session, pin_id: int):
    pin = db.query(Pin).filter(Pin.id == pin_id).first()
    if not pin:
        return None

    db.delete(pin)
    db.commit()
    return pin