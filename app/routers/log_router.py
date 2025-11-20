from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.models.log_model import Log
from app.schemas.log_schema import LogResponse, LogCreate, LogUpdate
from app.crud import log_crud
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/logs", tags=["Logs"])


# ---------------------------
# DB 세션
# ---------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------
# 전체 로그 조회
# ---------------------------
@router.get("/", response_model=List[LogResponse])
def read_logs(db: Session = Depends(get_db)):
    return log_crud.get_logs(db)


# ---------------------------
# 🔥 오늘 요약 (입고/출고/등록 카운트)
# ---------------------------
@router.get("/today-summary")
def get_today_summary(db: Session = Depends(get_db)):

    # 한국 시간 기준 날짜
    now_kst = datetime.now(timezone(timedelta(hours=9)))
    today = now_kst.date()

    logs = db.query(Log).all()

    inbound = 0
    outbound = 0
    created = 0

    for log in logs:
        if not log.timestamp:
            continue

        # timestamp를 KST로 변환
        log_time = log.timestamp.astimezone(timezone(timedelta(hours=9)))

        if log_time.date() != today:
            continue

        if "입고 완료" in log.action:
            inbound += 1
        if "출고 완료" in log.action:
            outbound += 1
        if log.action.startswith("상품 등록"):
            created += 1

    return {
        "inbound": inbound,
        "outbound": outbound,
        "created": created
    }


# ---------------------------
# 🔥 최근 입/출고 작업 5개
# ---------------------------
@router.get("/recent-tasks")
def get_recent_tasks(db: Session = Depends(get_db)):

    logs = (
        db.query(Log)
        .filter(
            Log.action.like("입고 완료%") |
            Log.action.like("출고 완료%")
        )
        .order_by(Log.timestamp.desc())
        .limit(5)
        .all()
    )

    result = []
    for log in logs:
        time_kst = log.timestamp.astimezone(timezone(timedelta(hours=9))).strftime("%H:%M")

        result.append({
            "time": time_kst,
            "robot": log.robot_name,
            "stock": log.stock_name,
            "qty": log.quantity,
            "pin": log.pin_name,
            "type": "입고" if "입고" in log.action else "출고",
        })

    return result


# ---------------------------
# 단일 로그 조회
# (⚠️ 변수 라우트는 반드시 맨 뒤로!)
# ---------------------------
@router.get("/{log_id}", response_model=LogResponse)
def read_log(log_id: int, db: Session = Depends(get_db)):
    log = log_crud.get_log_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


# ---------------------------
# 로그 생성
# ---------------------------
@router.post("/", response_model=LogResponse)
def create_log(log: LogCreate, db: Session = Depends(get_db)):
    return log_crud.create_log(db, log)


# ---------------------------
# 로그 수정
# ---------------------------
@router.put("/{log_id}", response_model=LogResponse)
def update_log(log_id: int, log_data: LogUpdate, db: Session = Depends(get_db)):
    updated = log_crud.update_log(db, log_id, log_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Log not found")
    return updated


# ---------------------------
# 로그 삭제
# ---------------------------
@router.delete("/{log_id}", response_model=LogResponse)
def delete_log(log_id: int, db: Session = Depends(get_db)):
    deleted = log_crud.delete_log(db, log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Log not found")
    return deleted