# app/routers/stock_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.models.stock import Stock
from app.schemas.stock_schema import StockResponse, StockCreate, StockUpdate

router = APIRouter(prefix="/stocks", tags=["Stocks"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# READ-ALL 전체 재고 조회
@router.get("/", response_model=List[StockResponse])
def read_stocks(db: Session = Depends(get_db)):
    return db.query(Stock).all()

# READ 단일 재고 조회
@router.get("/{stock_id}", response_model=StockResponse)
def read_stock(stock_id: int, db: Session = Depends(get_db)):
    stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock

# CREATE 재고 생성
@router.post("/", response_model=StockResponse)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    db_stock = Stock(**stock.dict())
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock

# UPDATE 재고 수정
@router.put("/{stock_id}", response_model=StockResponse)
def update_stock(stock_id: int, update_data: StockUpdate, db: Session = Depends(get_db)):
    stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(stock, key, value)
    db.commit()
    db.refresh(stock)
    return stock

# DELETE 재고 삭제
@router.delete("/{stock_id}", response_model=StockResponse)
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    db.delete(stock)
    db.commit()
    return stock