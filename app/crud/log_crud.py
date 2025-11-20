from sqlalchemy.orm import Session
from app.models.log_model import Log
from app.schemas.log_schema import LogCreate, LogUpdate
from app.websocket.manager import ws_manager


# READ-ALL 전체 로그 조회
def get_logs(db: Session):
    return db.query(Log).all()


# READ 단일 로그 조회 (ID 기준)
def get_log_by_id(db: Session, log_id: int):
    return db.query(Log).filter(Log.id == log_id).first()


# CREATE 새로운 로그 데이터 추가
def create_log(db, log_data):
    new_log = Log(**log_data.dict())
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    # 🔥 새로운 로그 생성 → 대시보드에 즉시 알림
    ws_manager.broadcast({
        "type": "new_log",
        "payload": {
            "id": new_log.id
        }
    })

    return new_log


# UPDATE 로그 데이터 수정
def update_log(db: Session, log_id: int, log_data: LogUpdate):
    db_log = db.query(Log).filter(Log.id == log_id).first()
    if not db_log:
        return None

    # 수정 요청된 필드만 갱신 (exclude_unset=True → 전달된 값만 업데이트)
    for key, value in log_data.dict(exclude_unset=True).items():
        setattr(db_log, key, value)

    db.commit()        # 변경사항 저장
    db.refresh(db_log) # 최신 상태로 갱신
    return db_log


# DELETE 로그 데이터 삭제
def delete_log(db: Session, log_id: int):
    db_log = db.query(Log).filter(Log.id == log_id).first()
    if not db_log:
        return None

    db.delete(db_log)  # 세션에서 삭제
    db.commit()        # 실제 DB 반영
    return db_log
