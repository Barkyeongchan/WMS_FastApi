from fastapi import FastAPI, Request, WebSocket
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


# WebSocket 엔드포인트 추가
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[EC2] WebSocket connected")
    try:
        while True:
            data = await websocket.receive_text()
            print(f"[RECEIVED] ← {data}")
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        print("[EC2] WebSocket disconnected", e)