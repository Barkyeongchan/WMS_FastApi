from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.category_model import Category
from app.models.pin_model import Pin
from app.schemas.stock_schema import StockResponse, StockCreate, StockUpdate

router = APIRouter(prefix="/stocks", tags=["Stocks"])

# DB 세션 생성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ READ-ALL 전체 재고 조회 (카테고리/핀 JOIN 포함)
@router.get("/", response_model=List[StockResponse])
def read_stocks(db: Session = Depends(get_db)):
    stocks = (
        db.query(Stock)
        .options(joinedload(Stock.category), joinedload(Stock.pin))
        .all()
    )
    result = []
    for s in stocks:
        result.append(StockResponse(
            id=s.id,
            name=s.name,
            quantity=s.quantity,
            category_name=s.category.name if s.category else "",
            pin_name=s.pin.name if s.pin else ""
        ))
    return result

# ✅ READ 단일 재고 조회
@router.get("/{stock_id}", response_model=StockResponse)
def read_stock(stock_id: int, db: Session = Depends(get_db)):
    s = (
        db.query(Stock)
        .options(joinedload(Stock.category), joinedload(Stock.pin))
        .filter(Stock.id == stock_id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Stock not found")
    return StockResponse(
        id=s.id,
        name=s.name,
        quantity=s.quantity,
        category_name=s.category.name if s.category else "",
        pin_name=s.pin.name if s.pin else ""
    )

# ✅ CREATE 재고 생성
@router.post("/", response_model=StockResponse)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == stock.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Invalid category_id")

    pin = db.query(Pin).filter(Pin.id == stock.pin_id).first()
    if not pin:
        raise HTTPException(status_code=400, detail="Invalid pin_id")

    new = Stock(
        name=stock.name,
        quantity=stock.quantity,
        category_id=stock.category_id,
        pin_id=stock.pin_id,
    )
    db.add(new)
    db.commit()
    db.refresh(new)

    return StockResponse(
        id=new.id,
        name=new.name,
        quantity=new.quantity,
        category_name=category.name,
        pin_name=pin.name,
    )

# ✅ UPDATE 재고 수정
@router.put("/{stock_id}", response_model=StockResponse)
def update_stock(stock_id: int, update_data: StockUpdate, db: Session = Depends(get_db)):
    s = db.query(Stock).filter(Stock.id == stock_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stock not found")

    # 전달된 필드만 업데이트
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(s, key, value)

    db.commit()
    db.refresh(s)

    # 응답용으로 카테고리/핀 이름 포함
    s = (
        db.query(Stock)
        .options(joinedload(Stock.category), joinedload(Stock.pin))
        .filter(Stock.id == stock_id)
        .first()
    )
    return StockResponse(
        id=s.id,
        name=s.name,
        quantity=s.quantity,
        category_name=s.category.name if s.category else "",
        pin_name=s.pin.name if s.pin else ""
    )

# ✅ DELETE 재고 삭제 (삭제 전에 응답 본문 구성)
@router.delete("/{stock_id}", response_model=StockResponse)
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    s = (
        db.query(Stock)
        .options(joinedload(Stock.category), joinedload(Stock.pin))
        .filter(Stock.id == stock_id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Stock not found")

    resp = StockResponse(
        id=s.id,
        name=s.name,
        quantity=s.quantity,
        category_name=s.category.name if s.category else "",
        pin_name=s.pin.name if s.pin else ""
    )

    db.delete(s)
    db.commit()
    return resp