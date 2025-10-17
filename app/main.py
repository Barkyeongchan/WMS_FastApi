from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.log_service import LogService

# FastAPI 애플리케이션 생성
app = FastAPI(
    title="WMS FastAPI Server",
    debug=settings.DEBUG
)

# DB 세션 의존성 주입
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 루트 경로 (서버 상태 확인용)
@app.get("/")
def root():
    return {"message": "FastAPI 서버 실행"}


# 테스트용 엔드포인트: 로그 목록 조회
@app.get("/test_logs")
def test_logs(db: Session = Depends(get_db)):
    service = LogService(db)
    return service.list_logs()