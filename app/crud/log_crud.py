from sqlalchemy.orm import Session
from app.models.log import Log

# CREATE 새로운 로그 데이터 추가
def create_log(db: Session, log_data: dict):
    log = Log(**log_data)     # 전달받은 데이터(dict)를 Log 객체로 변환
    db.add(log)               # 세션에 추가
    db.commit()               # 변경사항 저장
    db.refresh(log)           # DB 반영된 최신 데이터로 갱신
    return log


# READ 특정 로그 ID로 조회
def get_log(db: Session, log_id: int):
    return db.query(Log).filter(Log.id == log_id).first()


# READ-ALL 전체 로그 또는 일부 로그 목록 조회
def get_logs(db: Session, skip: int = 0, limit: int = 100):   # skip: 건너뛸 수, limit: 최대 조회 수
    return db.query(Log).offset(skip).limit(limit).all()


# UPDATE 로그 데이터 수정
def update_log(db: Session, log_id: int, update_data: dict):
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        return None

    for key, value in update_data.items():   # 전달받은 필드만 업데이트
        setattr(log, key, value)

    db.commit()        # 변경사항 저장
    db.refresh(log)    # 최신 상태로 갱신
    return log


# DELETE 로그 데이터 삭제
def delete_log(db: Session, log_id: int):
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        return None

    db.delete(log)     # 세션에서 삭제
    db.commit()        # 실제 DB에 반영
    return log