from sqlalchemy.orm import Session
from app.crud import stocks_crud
from app.models.stocks import Stocks

class StocksService:
    """
    재고(Stocks) 관련 비즈니스 로직을 관리하는 서비스 클래스
    """
    def __init__(self, db: Session):
        self.db = db

    # CREATE 재고 추가
    def create_stock(self, name: str, category: str, pin: str, quantity: int):
        stock = Stocks(name=name, category=category, pin=pin, quantity=quantity)
        return stocks_crud.create_stock(self.db, stock)

    # READ 재고 목록 조회
    def list_stocks(self, skip: int = 0, limit: int = 100):
        return stocks_crud.get_stocks(self.db, skip, limit)