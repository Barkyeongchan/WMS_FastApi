from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# ✅ router들을 확실하게 임포트 (router 객체만 가져옴)
from app.routers.stock_router import router as stock_router
from app.routers.robot_router import router as robot_router
from app.routers.log_router import router as log_router
from app.routers.category_router import router as category_router
from app.routers.pin_router import router as pin_router
from app.routers.page_router import router as page_router

import json
from app.core.database import Base, engine
from app.models import *

app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

# CORS 허용 (로컬 PC나 다른 IP에서 접속 가능)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 등록 (/static 경로로 접근 가능)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# 템플릿 등록
templates = Jinja2Templates(directory="app/templates")


# ✅ 라우터 등록
app.include_router(page_router)
app.include_router(stock_router)
app.include_router(robot_router)
app.include_router(log_router)
app.include_router(category_router)
app.include_router(pin_router)


# 메인 페이지 (HTML 렌더링)
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "title": "WMS Dashboard"})


active_connections = []  # 현재 연결된 클라이언트 목록
latest_data = None       # 최근 수신한 ROS 데이터 저장


# WebSocket 엔드포인트 추가
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global latest_data
    await websocket.accept()
    active_connections.append(websocket)  # 연결 추가
    print("[EC2] WebSocket connected")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"[EC2] 수신 데이터 ← {data}")

            # JSON 형태 검사 (init_request 등 문자열은 제외)
            if not data or not data.startswith("{"):
                if data == "init_request" and latest_data:
                    await websocket.send_text(latest_data)
                    print("[EC2] 초기 데이터 전송 → 클라이언트")
                else:
                    print(f"[EC2] 비JSON 데이터 무시: {data}")
                continue

            # JSON 파싱
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                print(f"[EC2] JSON 파싱 실패: {data}")
                continue

            # 정상적인 JSON이면 최근 데이터로 저장
            latest_data = data

            # 모든 클라이언트에 브로드캐스트
            for conn in list(active_connections):
                try:
                    await conn.send_text(data)
                except Exception:
                    if conn in active_connections:
                        active_connections.remove(conn)
                        print("[EC2] 연결 해제된 클라이언트 제거")

    except WebSocketDisconnect:
        print("[EC2] WebSocket disconnected")
        if websocket in active_connections:
            active_connections.remove(websocket)


# ✅ DB 테이블 자동 생성
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    print("✅ DB 테이블 자동 생성 완료 ✅")