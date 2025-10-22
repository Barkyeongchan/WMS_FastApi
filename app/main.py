from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import log_router

app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

# CORS 허용 (로컬 PC나 다른 IP에서 접속 가능하게)
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

# 라우터 등록
app.include_router(log_router.router)

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

            # 초기 데이터 요청(init_request)이 오면 최근 데이터 전송
            if data == "init_request" and latest_data:
                await websocket.send_text(latest_data)
                print("[EC2] 초기 데이터 전송 → 클라이언트")
                continue

            # ROS → EC2로 들어오는 최신 데이터 저장
            latest_data = data

            # 모든 클라이언트에 브로드캐스트
            for conn in list(active_connections):  # 복사본 사용
                try:
                    await conn.send_text(data)
                except Exception:
                    # 죽은 소켓은 제거
                    if conn in active_connections:
                        active_connections.remove(conn)

    except WebSocketDisconnect:
        print("[EC2] WebSocket disconnected")
        if websocket in active_connections:
            active_connections.remove(websocket)