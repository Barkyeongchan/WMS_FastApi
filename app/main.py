from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

from app.routers.stock_router import router as stock_router
from app.routers.robot_router import router as robot_router
from app.routers.log_router import router as log_router
from app.routers.category_router import router as category_router
from app.routers.pin_router import router as pin_router
from app.routers.page_router import router as page_router

import json
from app.core.database import Base, engine
from app.models import *

# ✅ WebSocket 연결 관리 유틸
from app.websocket.manager import register, unregister, broadcast_text

# ✅ ROS 리스너 통합
from app.core.ros.listener import RosListenerManager
import threading

app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

# ✅ CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ 정적/템플릿 설정
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# ✅ 라우터 등록
app.include_router(page_router)
app.include_router(stock_router)
app.include_router(robot_router)
app.include_router(log_router)
app.include_router(category_router)
app.include_router(pin_router)

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "title": "WMS Dashboard"})

# ✅ 최근 수신 데이터 (init_request 용)
latest_data = None

# ✅ WebSocket 엔드포인트
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global latest_data
    await websocket.accept()
    await register(websocket)
    print("[WMS] WebSocket connected")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"[WMS] 수신 데이터 ← {data}")

            # ✅ init_request 대응
            if not data or not data.startswith("{"):
                if data == "init_request" and latest_data:
                    await websocket.send_text(latest_data)
                    print("[WMS] 초기 데이터 전송 → 클라이언트")
                else:
                    print(f"[WMS] 비JSON 데이터 무시: {data}")
                continue

            # ✅ JSON 파싱
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                print(f"[WMS] JSON 파싱 실패: {data}")
                continue

            # ✅ 최신 데이터 저장
            latest_data = data

            # ✅ 로컬 → 웹 실시간 브로드캐스트
            await broadcast_text(data)

    except WebSocketDisconnect:
        print("[WMS] WebSocket disconnected")
        await unregister(websocket)

# ✅ DB 테이블 자동 생성 + ROS 통합 시작
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    print("✅ DB 테이블 자동 생성 완료 ✅")

    # ✅ ROS Listener Manager 실행
    def run_ros_listener():
        ros_manager = RosListenerManager(host="192.168.1.47", port=9090)
        ros_manager.start()

    thread = threading.Thread(target=run_ros_listener, daemon=True)
    thread.start()
    print("✅ ROS Listener 스레드 실행 중...")

@app.on_event("shutdown")
def on_shutdown():
    print("🛑 서버 종료 중...")