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

# 핀 관련 API 라우터
router = APIRouter(prefix="/pins", tags=["Pins"])


# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 핀 전체 조회
@router.get("/", response_model=List[PinResponse])
def read_pins(db: Session = Depends(get_db)):
    return db.query(Pin).all()


# 핀 생성
@router.post("/", response_model=PinResponse)
def create_pin(pin: PinCreate, db: Session = Depends(get_db)):
    # 새 핀 생성
    new_pin = Pin(**pin.dict())
    db.add(new_pin)
    db.commit()
    db.refresh(new_pin)

    # 핀 등록 로그 기록
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


# 핀 삭제
@router.delete("/{pin_id}", response_model=PinResponse)
def delete_pin(pin_id: int, db: Session = Depends(get_db)):
    # 삭제 대상 핀 조회
    pin = db.query(Pin).filter(Pin.id == pin_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    # 핀을 사용하는 상품 존재 여부 확인
    linked = db.query(Stock).filter(Stock.pin_id == pin_id).count()
    if linked > 0:
        raise HTTPException(
            status_code=400,
            detail=f"삭제 불가: '{pin.name}' 위치를 사용하는 상품이 {linked}개 존재합니다.",
        )

    # 핀 삭제 로그 기록
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

    # 핀 삭제 처리
    db.delete(pin)
    db.commit()

    # 핀 테이블 비어있을 경우 AUTO_INCREMENT 초기화
    remaining = db.execute(text("SELECT COUNT(*) FROM pin")).scalar()
    if remaining == 0:
        db.execute(text("ALTER TABLE pin AUTO_INCREMENT = 1"))
        db.commit()

    return pin