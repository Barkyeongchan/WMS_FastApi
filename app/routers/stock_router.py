from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List
from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.category_model import Category
from app.models.pin_model import Pin
from app.schemas.stock_schema import StockResponse, StockCreate, StockUpdate
from app.models.log_model import Log
from app.schemas.log_schema import LogCreate
from app.crud import log_crud

# 재고 관련 API 라우터
router = APIRouter(prefix="/stocks", tags=["Stocks"])


# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 전체 재고 조회
@router.get("/", response_model=List[StockResponse])
def read_stocks(db: Session = Depends(get_db)):
    # 카테고리/핀 조인 로드
    stocks = db.query(Stock).options(joinedload(Stock.category), joinedload(Stock.pin)).all()

    # 응답 스키마 변환
    return [
        StockResponse(
            id=s.id,
            name=s.name,
            quantity=s.quantity,
            category_name=s.category.name if s.category else "",
            pin_name=s.pin.name if s.pin else "",
        )
        for s in stocks
    ]


# 재고 생성
@router.post("/", response_model=StockResponse)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    # category_id / pin_id 유효성 확인
    category = db.query(Category).filter(Category.id == stock.category_id).first()
    pin = db.query(Pin).filter(Pin.id == stock.pin_id).first()
    if not category or not pin:
        raise HTTPException(status_code=400, detail="Invalid category_id or pin_id")

    # 새 재고 생성
    new = Stock(
        name=stock.name,
        quantity=stock.quantity,
        category_id=stock.category_id,
        pin_id=stock.pin_id,
    )
    db.add(new)
    db.commit()
    db.refresh(new)

    # 상품 등록 로그 기록
    log_crud.create_log(
        db,
        LogCreate(
            robot_name="-",
            robot_ip=None,
            pin_name=pin.name,
            pin_coords=None,
            category_name=category.name,
            stock_name=stock.name,
            stock_id=new.id,
            quantity=stock.quantity,
            action="상품 등록",
            timestamp=datetime.now(timezone(timedelta(hours=9))),
        ),
    )

    return StockResponse(
        id=new.id,
        name=new.name,
        quantity=new.quantity,
        category_name=category.name,
        pin_name=pin.name,
    )


# 재고 수정
@router.put("/{stock_id}", response_model=StockResponse)
def update_stock(stock_id: int, update_data: StockUpdate, db: Session = Depends(get_db)):
    # 수정 대상 재고 조회
    s = db.query(Stock).filter(Stock.id == stock_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stock not found")

    # 기존 값 저장
    old_name = s.name
    old_qty = s.quantity
    old_category_id = s.category_id
    old_pin_id = s.pin_id

    # 변경값 적용
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(s, key, value)

    db.commit()
    db.refresh(s)

    # 최신 값 조인 로드
    s = (
        db.query(Stock)
        .options(joinedload(Stock.category), joinedload(Stock.pin))
        .filter(Stock.id == stock_id)
        .first()
    )

    new_name = s.name
    new_qty = s.quantity
    new_cat = s.category.name if s.category else "-"
    new_pin = s.pin.name if s.pin else "-"

    # 변경 내역 수집
    changed_fields = []

    # 이름 변경 감지
    if old_name != new_name:
        changed_fields.append(f"이름 '{old_name}' → '{new_name}'")

    # 수량 변경 감지
    if old_qty != new_qty:
        changed_fields.append(f"수량 {old_qty} → {new_qty}")

    # 카테고리 변경 감지
    if old_category_id != s.category_id:
        old_cat = db.query(Category).filter(Category.id == old_category_id).first()
        old_cat_name = old_cat.name if old_cat else "-"
        changed_fields.append(f"카테고리 {old_cat_name} → {new_cat}")

    # 위치 변경 감지
    if old_pin_id != s.pin_id:
        old_pin = db.query(Pin).filter(Pin.id == old_pin_id).first()
        old_pin_name = old_pin.name if old_pin else "-"
        changed_fields.append(f"위치 {old_pin_name} → {new_pin}")

    # 로그 action 문자열 생성
    action_txt = "상품 수정"
    if changed_fields:
        action_txt += f" ({', '.join(changed_fields)})"

    # 상품 수정 로그 기록
    log_crud.create_log(
        db,
        LogCreate(
            robot_name="-",
            robot_ip=None,
            pin_name=new_pin,
            pin_coords=None,
            category_name=new_cat,
            stock_name=new_name,
            stock_id=s.id,
            quantity=new_qty,
            action=action_txt,
            timestamp=datetime.now(timezone(timedelta(hours=9))),
        ),
    )

    return StockResponse(
        id=s.id,
        name=new_name,
        quantity=new_qty,
        category_name=new_cat,
        pin_name=new_pin,
    )


# 재고 삭제
@router.delete("/{stock_id}", response_model=StockResponse)
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    # 삭제 대상 재고 조회 (조인 포함)
    s = (
        db.query(Stock)
        .options(joinedload(Stock.category), joinedload(Stock.pin))
        .filter(Stock.id == stock_id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Stock not found")

    # 삭제 전 응답 데이터 구성
    resp = StockResponse(
        id=s.id,
        name=s.name,
        quantity=s.quantity,
        category_name=s.category.name if s.category else "",
        pin_name=s.pin.name if s.pin else "",
    )

    # 상품 삭제 로그 기록
    log_crud.create_log(
        db,
        LogCreate(
            robot_name="-",
            robot_ip=None,
            pin_name=resp.pin_name,
            pin_coords=None,
            category_name=resp.category_name,
            stock_name=resp.name,
            stock_id=resp.id,
            quantity=resp.quantity,
            action="상품 삭제",
            timestamp=datetime.now(timezone(timedelta(hours=9))),
        ),
    )

    # 재고 삭제 처리
    db.delete(s)
    db.commit()

    # 재고 테이블 비어있을 경우 AUTO_INCREMENT 초기화
    remaining = db.execute(text("SELECT COUNT(*) FROM stock")).scalar()
    if remaining == 0:
        db.execute(text("ALTER TABLE stock AUTO_INCREMENT = 1"))
        db.commit()

    return resp