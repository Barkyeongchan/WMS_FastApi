# app/crud/stock_crud.py
from sqlalchemy.orm import Session
from app.models.stock_model import Stock
from app.schemas.stock_schema import StockCreate, StockUpdate


# READ-ALL 전체 재고 조회
def get_stocks(db: Session):
    return db.query(Stock).all()


# READ 단일 재고 조회 (ID 기준)
def get_stock_by_id(db: Session, stock_id: int):
    return db.query(Stock).filter(Stock.id == stock_id).first()


# CREATE
def create_stock(db: Session, stock: StockCreate):
    db_stock = Stock(**stock.dict())
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock


# UPDATE
def update_stock(db: Session, stock_id: int, update_data: StockUpdate):
    db_stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not db_stock:
        return None

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(db_stock, key, value)

    db.commit()
    db.refresh(db_stock)
    return db_stock


# DELETE
def delete_stock(db: Session, stock_id: int):
    db_stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not db_stock:
        return None

    db.delete(db_stock)
    db.commit()
    return db_stock


# 수량 업데이트 함수
def update_stock_quantity(db: Session, stock_id: int, new_quantity: int):
    """
    DB 수량 업데이트만 하고 WebSocket 브로드캐스트는 manager.py에서 처리함
    (중복 전송 / 상태 꼬임 방지)
    """
    stock = db.query(Stock).filter(Stock.id == stock_id).first()
    if not stock:
        return None

    stock.quantity = new_quantity
    db.commit()
    db.refresh(stock)

    return stock