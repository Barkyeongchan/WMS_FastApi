from sqlalchemy.orm import Session
from app.crud import log_crud
from app.models.log import Log

class LogService:
    
    def __init__(self, db: Session):
        self.db = db  # 데이터베이스 세션 주입 (DI 방식)

    # CREATE 로그 생성
    def create_log_entry(self, robot_name: str, pin_name: str, product_name: str,
                         quantity: int, action: str, timestamp):
        log = Log(
            robot_name=robot_name,
            pin_name=pin_name,
            product_name=product_name,
            quantity=quantity,
            action=action,
            timestamp=timestamp
        )
        return log_crud.create_log(self.db, log)

    # READ 전체 로그 조회
    def list_logs(self, skip: int = 0, limit: int = 100):
        return log_crud.get_logs(self.db, skip, limit)