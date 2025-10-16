from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import asyncio
from app.websocket import ros_ws_task, websocket_endpoint

app = FastAPI()

# 정적 파일과 템플릿
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(ros_ws_task())

@app.websocket("/ws")
async def ws_endpoint_route(websocket: WebSocket):
    await websocket_endpoint(websocket)
