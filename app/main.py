from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from app.core.config import settings
from app.routers import log_router

app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

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