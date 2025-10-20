from sqlalchemy.orm import Session
from app.crud import stock_crud
from app.models.stock_model import Stock

class StockService:
    def __init__(self, db: Session):
        self.db = db

    # CREATE 재고 등록
    def create_stock(self, name: str, category: str, pin: str, quantity: int):
        stock = Stock(
            name=name,
            category=category,
            pin=pin,
            quantity=quantity
        )
        return stock_crud.create_stock(self.db, stock)

    # READ 전체 재고 조회
    def list_stocks(self, skip: int = 0, limit: int = 100):
        return stock_crud.get_stocks(self.db, skip, limit)