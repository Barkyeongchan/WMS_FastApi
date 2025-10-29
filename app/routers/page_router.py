from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")  # html 파일 저장 폴더

@router.get("/index", response_class=HTMLResponse)
async def show_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/stock", response_class=HTMLResponse)
async def show_stocks(request: Request):
    return templates.TemplateResponse("stock.html", {"request": request})

@router.get("/robot", response_class=HTMLResponse)
async def show_stocks(request: Request):
    return templates.TemplateResponse("robot.html", {"request": request})

@router.get("/log", response_class=HTMLResponse)
async def show_stocks(request: Request):
    return templates.TemplateResponse("log.html", {"request": request})