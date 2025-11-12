# app/main.py
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

from app.websocket.manager import register, unregister
from app.core.database import Base, engine

# ✅ 추가
from app.core.ros.ros_manager import ros_manager
from app.core.ros.publisher import RosPublisher  # ✅ 퍼블리셔 임포트

import threading
import json

# ---------------------------------------------
# ✅ FastAPI 기본 설정
# ---------------------------------------------
app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# ---------------------------------------------
# ✅ 라우터 등록
# ---------------------------------------------
app.include_router(page_router)
app.include_router(stock_router)
app.include_router(robot_router)
app.include_router(log_router)
app.include_router(category_router)
app.include_router(pin_router)


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "title": "WMS Dashboard"})


# ---------------------------------------------
# ✅ ROS 퍼블리셔 전역 인스턴스
# ---------------------------------------------
ros_publisher = None


# ---------------------------------------------
# ✅ WebSocket 엔드포인트
# ---------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global ros_publisher
    await websocket.accept()
    await register(websocket)
    print("[WS] 클라이언트 연결됨 ✅")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"[WS] 수신 ← {data}")

            try:
                msg = json.loads(data)
                msg_type = msg.get("type")
                payload = msg.get("payload", {})

                # ✅ cmd_vel 제어 명령 처리
                if msg_type == "cmd_vel":
                    if not ros_manager.active_robot:
                        print("[WARN] 활성 로봇 없음 → 제어 불가")
                        continue

                    # 현재 활성 로봇의 ROS 인스턴스 가져오기
                    active = ros_manager.active_robot
                    client = ros_manager.clients.get(active)
                    if not client or not client.ros or not client.ros.is_connected:
                        print("[WARN] ROS 연결 안 됨 → 퍼블리시 불가")
                        continue

                    # 퍼블리셔 없으면 새로 생성
                    if not ros_publisher:
                        ros_publisher = RosPublisher(client.ros)

                    # 퍼블리시 실행
                    ros_publisher.publish_command(payload)

            except json.JSONDecodeError:
                print("[ERROR] 잘못된 JSON 수신:", data)
                continue

    except WebSocketDisconnect:
        await unregister(websocket)
        print("[WS] 연결 해제 ❌")


# ---------------------------------------------
# ✅ 서버 이벤트 훅
# ---------------------------------------------
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    print("✅ DB 테이블 자동 생성 완료 ✅")
    print("🚀 FastAPI + ROS Bridge 서버 시작 중...")
    print("⚙️  ros_manager는 동적으로 로봇 연결 시 활성화됩니다.")


@app.on_event("shutdown")
def on_shutdown():
    print("🛑 서버 종료 중...")
    if ros_manager.active_robot:
        ros_manager.disconnect_robot(ros_manager.active_robot)
    print("🧹 모든 ROS 연결 종료 완료")