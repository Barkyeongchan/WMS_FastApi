from sqlalchemy.orm import Session
from app.models.stock_model import Stock

# CREATE 새로운 재고 데이터 추가
def create_stock(db: Session, stock_data: dict):
    stock = Stocks(**stock_data)
    db.add(stock)
    db.commit()
    db.refresh(stock)
    return stock


# READ 특정 재고 ID로 조회
def get_stock(db: Session, stock_id: int):
    return db.query(Stocks).filter(Stocks.id == stock_id).first()


# READ-ALL 전체 재고 목록 조회
def get_stocks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Stocks).offset(skip).limit(limit).all()


# UPDATE 재고 데이터 수정
def update_stock(db: Session, stock_id: int, update_data: dict):
    stock = db.query(Stocks).filter(Stocks.id == stock_id).first()
    if not stock:
        return None

    for key, value in update_data.items():
        setattr(stock, key, value)

    db.commit()
    db.refresh(stock)
    return stock


# DELETE 재고 데이터 삭제
def delete_stock(db: Session, stock_id: int):
    stock = db.query(Stocks).filter(Stocks.id == stock_id).first()
    if not stock:
        return None

    db.delete(stock)
    db.commit()
    return stock