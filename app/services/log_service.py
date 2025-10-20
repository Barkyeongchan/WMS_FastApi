from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.crud import log_crud
from app.models.log_model import Log


class LogService:
    def __init__(self, db: Session):
        self.db = db  # DB 세션

    # CREATE 로그 생성
    def create_log_entry(
        self,
        robot_name: str,
        pin_name: str,
        category_name: str,
        stock_name: str,
        quantity: int,
        action: str,
        timestamp: datetime,
        robot_ip: Optional[str] = None,
        pin_coords: Optional[str] = None,
        stock_id: Optional[int] = None,
    ):

        log = Log(
            robot_name=robot_name,
            robot_ip=robot_ip,
            pin_name=pin_name,
            pin_coords=pin_coords,
            category_name=category_name,
            stock_name=stock_name,
            stock_id=stock_id,
            quantity=quantity,
            action=action,
            timestamp=timestamp,
        )
        return log_crud.create_log(self.db, log)

    # READ 전체 로그 조회
    def list_logs(self, skip: int = 0, limit: int = 100):
        return log_crud.get_logs(self.db, skip, limit)
