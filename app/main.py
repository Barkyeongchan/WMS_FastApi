# app/main.py
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.routers.stock_router import router as stock_router
from app.routers.robot_router import router as robot_router
from app.routers.log_router import router as log_router
from app.routers.category_router import router as category_router
from app.routers.pin_router import router as pin_router
from app.routers.page_router import router as page_router
from app.routers.map_router import router as map_router

from app.websocket.manager import register, unregister, handle_message
from app.core.database import Base, engine

from app.core.ros.ros_manager import ros_manager
from app.core.ros.publisher import RosPublisher

import json

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

# 라우터 등록
app.include_router(page_router)
app.include_router(stock_router)
app.include_router(robot_router)
app.include_router(log_router)
app.include_router(category_router)
app.include_router(pin_router)
app.include_router(map_router)


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await register(websocket)
    print("[WS] 클라이언트 연결됨 ✅")

    try:
        while True:
            raw_data = await websocket.receive_text()
            print(f"[WS] 수신 ← {raw_data}")

            try:
                msg = json.loads(raw_data)
            except:
                print("[WS] ❌ JSON parsing 실패")
                continue

            # 🔥 여기서 모든 메시지 중앙 처리
            await handle_message(websocket, msg)

    except WebSocketDisconnect:
        await unregister(websocket)
        print("[WS] 연결 해제 ❌")


# 서버 이벤트 훅
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    print("✅ DB 테이블 자동 생성 완료")
    print("🚀 서버 시작 중... (ROS 연결은 요청 시 활성화)")


@app.on_event("shutdown")
def on_shutdown():
    print("🛑 서버 종료 중…")
    if ros_manager.active_robot:
        ros_manager.disconnect_robot(ros_manager.active_robot)
    print("🧹 모든 ROS 연결 종료 완료")