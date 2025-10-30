# app/routers/pin_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.models.pin_model import Pin
from app.schemas.pin_schema import PinResponse, PinCreate, PinUpdate

router = APIRouter(prefix="/pins", tags=["Pins"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# READ-ALL 전체 핀 조회
@router.get("/", response_model=List[PinResponse])
def read_pins(db: Session = Depends(get_db)):
    return db.query(Pin).all()

# READ 단일 핀 조회
@router.get("/{pin_id}", response_model=PinResponse)
def read_pin(pin_id: int, db: Session = Depends(get_db)):
    pin = db.query(Pin).filter(Pin.id == pin_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    return pin

# CREATE 핀 생성
@router.post("/", response_model=PinResponse)
def create_pin(pin: PinCreate, db: Session = Depends(get_db)):
    db_pin = Pin(**pin.dict())
    db.add(db_pin)
    db.commit()
    db.refresh(db_pin)
    return db_pin

# UPDATE 핀 수정
@router.put("/{pin_id}", response_model=PinResponse)
def update_pin(pin_id: int, update_data: PinUpdate, db: Session = Depends(get_db)):
    pin = db.query(Pin).filter(Pin.id == pin_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(pin, key, value)
    db.commit()
    db.refresh(pin)
    return pin

# DELETE 핀 삭제
@router.delete("/{pin_id}", response_model=PinResponse)
def delete_pin(pin_id: int, db: Session = Depends(get_db)):
    pin = db.query(Pin).filter(Pin.id == pin_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    db.delete(pin)
    db.commit()
    return pin