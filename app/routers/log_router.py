from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.models.log_model import Log
from app.schemas.log_schema import LogResponse, LogCreate, LogUpdate
from app.crud import log_crud

# Logs 관련 라우터 설정
router = APIRouter(prefix="/logs", tags=["Logs"])


# DB 세션 생성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# READ-ALL 전체 로그 조회
@router.get("/", response_model=List[LogResponse])
def read_logs(db: Session = Depends(get_db)):
    return log_crud.get_logs(db)


# READ 단일 로그 조회 (ID 기준)
@router.get("/{log_id}", response_model=LogResponse)
def read_log(log_id: int, db: Session = Depends(get_db)):
    log = log_crud.get_log_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


# CREATE 새로운 로그 추가
@router.post("/", response_model=LogResponse)
def create_log(log: LogCreate, db: Session = Depends(get_db)):
    return log_crud.create_log(db, log)


# UPDATE 로그 데이터 수정
@router.put("/{log_id}", response_model=LogResponse)
def update_log(log_id: int, log_data: LogUpdate, db: Session = Depends(get_db)):
    updated = log_crud.update_log(db, log_id, log_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Log not found")
    return updated


# DELETE 로그 데이터 삭제
@router.delete("/{log_id}", response_model=LogResponse)
def delete_log(log_id: int, db: Session = Depends(get_db)):
    deleted = log_crud.delete_log(db, log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Log not found")
    return deleted