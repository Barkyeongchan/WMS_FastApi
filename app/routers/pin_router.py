from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.pin_model import Pin
from app.models.stock_model import Stock
from app.schemas.pin_schema import PinResponse, PinCreate
from app.models.log_model import Log
from app.schemas.log_schema import LogCreate
from app.crud import log_crud

router = APIRouter(prefix="/pins", tags=["Pins"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[PinResponse])
def read_pins(db: Session = Depends(get_db)):
    return db.query(Pin).all()


@router.post("/", response_model=PinResponse)
def create_pin(pin: PinCreate, db: Session = Depends(get_db)):
    new_pin = Pin(**pin.dict())
    db.add(new_pin)
    db.commit()
    db.refresh(new_pin)

    log_crud.create_log(
        db,
        LogCreate(
            robot_name="-",
            robot_ip=None,
            pin_name=new_pin.name,
            pin_coords=None,
            category_name="-",
            stock_name="-",
            stock_id=None,
            quantity=0,
            action="핀 등록",
            timestamp=datetime.now(timezone(timedelta(hours=9))),
        ),
    )

    return new_pin


@router.delete("/{pin_id}", response_model=PinResponse)
def delete_pin(pin_id: int, db: Session = Depends(get_db)):
    pin = db.query(Pin).filter(Pin.id == pin_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    linked = db.query(Stock).filter(Stock.pin_id == pin_id).count()
    if linked > 0:
        raise HTTPException(
            status_code=400,
            detail=f"삭제 불가: '{pin.name}' 위치를 사용하는 상품이 {linked}개 존재합니다.",
        )

    log_crud.create_log(
        db,
        LogCreate(
            robot_name="-",
            robot_ip=None,
            pin_name=pin.name,
            pin_coords=None,
            category_name="-",
            stock_name="-",
            stock_id=None,
            quantity=0,
            action="핀 삭제",
            timestamp=datetime.now(timezone(timedelta(hours=9))),
        ),
    )

    db.delete(pin)
    db.commit()

    remaining = db.execute(text("SELECT COUNT(*) FROM pin")).scalar()
    if remaining == 0:
        db.execute(text("ALTER TABLE pin AUTO_INCREMENT = 1"))
        db.commit()

    return pin