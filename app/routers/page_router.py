from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

# 페이지 렌더링용 라우터
router = APIRouter()

# Jinja2 템플릿 경로 설정
templates = Jinja2Templates(directory="app/templates")


# 대시보드 페이지
@router.get("/index", response_class=HTMLResponse)
async def show_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# 재고 관리 페이지
@router.get("/stock", response_class=HTMLResponse)
async def show_stock(request: Request):
    return templates.TemplateResponse("stock.html", {"request": request})


# 로봇 관리 페이지
@router.get("/robot", response_class=HTMLResponse)
async def show_robot(request: Request):
    return templates.TemplateResponse("robot.html", {"request": request})


# 작업 로그 페이지
@router.get("/log", response_class=HTMLResponse)
async def show_log(request: Request):
    return templates.TemplateResponse("log.html", {"request": request})


# 모바일 앱 페이지
@router.get("/app", response_class=HTMLResponse)
async def show_app(request: Request):
    return templates.TemplateResponse("app.html", {"request": request})