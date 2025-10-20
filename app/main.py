from fastapi import FastAPI
from app.routers import log_router

# FastAPI 애플리케이션 생성
app = FastAPI(title="WMS FastAPI Server", version="0.2.0")

# 기본 루트 엔드포인트
@app.get("/")
def root():
    return {"message": "FastAPI 서버 실행 중"}

# Logs 라우터 등록
app.include_router(log_router.router)