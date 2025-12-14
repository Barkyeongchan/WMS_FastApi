# FastAPI 로컬 서버 구축 및 ROS → 웹 클라이언트 실시간 연결  

## 1️⃣ 개요  

### 전체 흐름  

ROS → Local FastAPI (roslibpy 통합) → WebClient(JavaScript)

- EC2, RDS, 중계 프로그램 없이 **하나의 FastAPI 서버**만으로 ROS·DB·WebSocket·UI 통합
- 인터넷 연결 없이도 완전 동작 (오프라인 시뮬레이션 가능)
- 구조 단순화, 유지보수 용이성, 지연 최소화  



## 2️⃣ 폴더 구조  

```
WMS_FASTAPI/
├── alembic/          # DB 마이그레이션
├── app/
│   ├── core/         # 설정, DB, ROS, 메시지 처리
│   ├── crud/         # DB 접근 로직
│   ├── models/       # ORM 모델
│   ├── routers/      # REST API
│   ├── schemas/      # Pydantic 스키마
│   ├── services/     # 비즈니스 로직
│   ├── websocket/    # WebSocket 관리
│   ├── static/       # 정적 리소스
│   ├── templates/    # HTML 템플릿
│   └── main.py       # FastAPI 엔트리포인트
│
├── .env
├── requirements.txt
└── README.md
```

- `core/message` : ROS에서 수신한 데이터를 서버 내부 표준 포맷으로 변환

- `core/ros`     : roslibpy 기반 ROS 토픽 구독 및 명령 퍼블리시



## 3️⃣ .env (환경 변수 설정)
```bash
# DB (Local MariaDB / MySQL)
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=wasd_wms

# FastAPI 서버
SERVER_PORT=8000
DEBUG=True

# ROS (rosbridge)
ROS_HOST=127.0.0.1
ROS_PORT=9090
```

`.env` 파일로 ROS 브릿지, DB, 서버 포트를 한 곳에서 통합 제어 가능

실제 `.env` 값은 개발 환경에 맞게 설정하며, Git에 커밋하지 않음.



## 4️⃣ 가상환경 및 패키지 설치  

**가상환경 생성 / 활성화**
```bash
python -m venv venv
```

```bash
# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```
**requirements.txt로 설치**
```bash
pip install -r requirements.txt
```

**핵심 패키지**

- `fastapi` / `uvicorn` : 서버 실행(REST + WebSocket)
- `sqlalchemy` : DB ORM
- `mysqlclient` / pymysql : MariaDB(MySQL) 드라이버
- `alembic` : DB 마이그레이션
- `jinja2` : HTML 템플릿 렌더링
- `python-dotenv` : .env 로드
- `roslibpy` : rosbridge(WebSocket) 연결
- `pydantic==1.10.24` : FastAPI와 호환되는 데이터 검증(현재 프로젝트 기준)



## 5️⃣ FastAPI 핵심 구성  

| 파일 / 디렉터리 | 역할 |
|-----------------|------|
| core/config.py | 환경 변수 로드 및 전역 설정 |
| core/database.py | SQLAlchemy DB 엔진 및 세션 관리 |
| models/* | DB 테이블 ORM 모델 정의 |
| schemas/* | API 요청/응답 스키마(Pydantic) |
| crud/* | DB CRUD 함수(조회/생성/수정/삭제) |
| services/* | 비즈니스 로직 계층(작업 처리/규칙) |
| routers/* | REST API 엔드포인트 구성 |
| websocket/manager.py | WebSocket 연결 관리 및 브로드캐스트 |
| core/ros/ros_manager.py | ROS 연결 상태 관리 및 rosbridge 연동 |
| core/message/* | ROS ↔ 서버 메시지 표준화 및 가공 |
| static/* | 프론트 정적 리소스(CSS/JS/이미지/맵) |
| templates/* | Jinja2 HTML 템플릿 |
| main.py | FastAPI 서버 엔트리포인트 |



## 6️⃣ 주요 코드 (핵심) 

### app/core/config.py

```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    # DB 계정
    DB_USER: str
    DB_PASSWORD: str

    # DB 접속 정보
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    # 서버 설정
    SERVER_PORT: int
    DEBUG: bool = True

    class Config:
        # 환경 변수 파일
        env_file = ".env"

# 전역 설정 인스턴스
settings = Settings()
```

### app/core/database.py

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# DB 접속 URL
DB_URL = (
    f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?charset=utf8mb4"
)

# SQLAlchemy 엔진
engine = create_engine(DB_URL, pool_pre_ping=True)

# DB 세션 팩토리
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# ORM 베이스 클래스
Base = declarative_base()
```

### app/core/ros/ros_manager.py

> 단일 로봇 rosbridge 연결 + 토픽 구독 + UI 명령 퍼블리시
<br>
실제 코드에는 연결 모니터링/재연결/해제 처리까지 포함되어 있음 (README에서는 핵심 흐름만 발췌)

```python
import threading
import time
import roslibpy
from app.websocket.manager import ws_manager
from app.core.ros.listener import RosListener
from app.core.ros.publisher import RosPublisher

# UI 명령 토픽 타입
UI_CMD_TYPE = "std_msgs/String"


class ROSRobotConnection:
    # 로봇 1대의 rosbridge 연결 및 토픽 관리
    def __init__(self, name: str, ip: str, port: int = 9090):
        self.name = name
        self.ip = ip
        self.port = port
        self.ros = None
        self.listener = None
        self.publisher = None
        self.ui_topic = None
        self.connected = False

    def connect(self) -> bool:
        # rosbridge 연결 시도
        self.ros = roslibpy.Ros(host=self.ip, port=self.port)
        threading.Thread(target=self.ros.run, daemon=True).start()

        start = time.time()
        while time.time() - start < 2.5:
            if self.ros.is_connected:
                self.connected = True

                # ROS 토픽 구독
                self.listener = RosListener(self.ros, self.name)
                for t in ["/battery_state", "/odom", "/amcl_pose", "/diagnostics"]:
                    self.listener.subscribe(t)

                # cmd_vel 퍼블리셔
                self.publisher = RosPublisher(self.ros)

                # UI 명령 토픽
                self.ui_topic = roslibpy.Topic(
                    self.ros, "/wasd_ui_command", UI_CMD_TYPE
                )
                self.ui_topic.advertise()

                # 연결 상태 브로드캐스트
                self._broadcast_status(True)
                return True

            time.sleep(0.3)

        self._broadcast_status(False)
        return False

    def send_cmd_vel(self, payload: dict):
        # 속도 명령 전달
        if self.publisher:
            self.publisher.publish_command(payload)

    def send_ui_command(self, command: str):
        # UI 명령 전달
        if self.ui_topic:
            self.ui_topic.publish(roslibpy.Message({"data": command}))

    def _broadcast_status(self, connected: bool):
        # 웹소켓으로 연결 상태 전송
        ws_manager.broadcast({
            "type": "status",
            "payload": {
                "robot_name": self.name,
                "ip": self.ip,
                "connected": connected,
            },
        })


class ROSConnectionManager:
    # 다중 로봇 연결 관리 + 활성 로봇 제어
    def __init__(self):
        self.active_robot = None
        self.clients = {}
        self.last_pose = {}

    def connect_robot(self, name: str, ip: str):
        # 이미 연결된 로봇 활성화
        client = self.clients.get(name)
        if client and client.connected:
            self.active_robot = name
            client._broadcast_status(True)
            return

        # 신규 로봇 연결
        new_client = ROSRobotConnection(name, ip)
        if new_client.connect():
            self.clients[name] = new_client
            self.active_robot = name

    def send_cmd_vel(self, payload: dict):
        # 활성 로봇에 속도 명령 전달
        if self.active_robot in self.clients:
            self.clients[self.active_robot].send_cmd_vel(payload)

    def send_ui_command(self, command: str):
        # 활성 로봇에 UI 명령 전달
        if self.active_robot in self.clients:
            self.clients[self.active_robot].send_ui_command(command)


# 전역 ROS 매니저
ros_manager = ROSConnectionManager()
```

### app/websocket/manager.py

> 서버 내부 캐시 복구 + 브로드캐스트 + 핵심 메시지 처리
<br>
처리 메시지 타입 # cmd_vel / request_stock_move / complete_stock_move / robot_status / ui_command


```python
import asyncio
from fastapi import WebSocket
from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.pin_model import Pin
from app.schemas.log_schema import LogCreate
from app.crud import log_crud

# 활성 WebSocket 클라이언트
_active_clients = []

# 로봇 상태 캐시
robot_status_cache = {}

# 마지막 작업 캐시
_last_job = {"stock_id": None, "amount": None, "mode": None}


def now():
    # KST 현재 시간
    return datetime.now(timezone(timedelta(hours=9)))


async def register(ws: WebSocket):
    # 클라이언트 등록 및 상태 복구
    _active_clients.append(ws)

    for name, status in robot_status_cache.items():
        await ws.send_json({
            "type": "robot_status",
            "payload": {"name": name, "state": status.get("state", "대기중")},
        })

    try:
        from app.core.ros.ros_manager import ros_manager
        if ros_manager.last_pose:
            await ws.send_json({
                "type": "robot_pose_restore",
                "payload": ros_manager.last_pose
            })
    except:
        pass


async def unregister(ws: WebSocket):
    # 클라이언트 제거
    if ws in _active_clients:
        _active_clients.remove(ws)


async def broadcast_json(data: dict):
    # 모든 클라이언트에 브로드캐스트
    for ws in list(_active_clients):
        try:
            await ws.send_json(data)
        except:
            await unregister(ws)


class WSManager:
    # 동기 코드용 브로드캐스트 래퍼
    def __init__(self):
        self.loop = asyncio.get_event_loop()

    def broadcast(self, data: dict):
        asyncio.run_coroutine_threadsafe(
            broadcast_json(data), self.loop
        )


# 전역 WS 매니저
ws_manager = WSManager()


async def handle_message(ws: WebSocket, data: dict):
    # WebSocket 메시지 처리
    global _last_job

    t = data.get("type")
    p = data.get("payload") or {}

    if t == "cmd_vel":
        from app.core.ros.ros_manager import ros_manager
        ros_manager.send_cmd_vel(p)
        return

    if t == "request_stock_move":
        from app.core.ros.ros_manager import ros_manager

        stock_id = p.get("stock_id")
        amount = int(p.get("amount"))
        mode = p.get("mode")

        db = SessionLocal()
        stock = db.query(Stock).filter(Stock.id == stock_id).first()
        pin = db.query(Pin).filter(Pin.id == stock.pin_id).first()

        _last_job = {"stock_id": stock_id, "amount": amount, "mode": mode}

        ros_manager.send_ui_command(pin.name)

        log_crud.create_log(db, LogCreate(
            robot_name=ros_manager.active_robot,
            pin_name=pin.name,
            category_name=stock.category.name,
            stock_name=stock.name,
            stock_id=stock_id,
            quantity=amount,
            action="입고 시작" if mode == "INBOUND" else "출고 시작",
            timestamp=now(),
        ))
        db.close()

        ws_manager.broadcast({
            "type": "robot_status",
            "payload": {"state": "이동중"},
        })
        return

    if t == "complete_stock_move":
        from app.core.ros.ros_manager import ros_manager

        db = SessionLocal()
        stock = db.query(Stock).filter(Stock.id == _last_job["stock_id"]).first()

        old_qty = stock.quantity
        if _last_job["mode"] == "INBOUND":
            stock.quantity += _last_job["amount"]
        else:
            stock.quantity = max(stock.quantity - _last_job["amount"], 0)
        db.commit()

        log_crud.create_log(db, LogCreate(
            robot_name=ros_manager.active_robot,
            pin_name=stock.pin.name,
            category_name=stock.category.name,
            stock_name=stock.name,
            stock_id=stock.id,
            quantity=_last_job["amount"],
            action=f"완료 ({old_qty} → {stock.quantity})",
            timestamp=now(),
        ))
        db.close()

        ros_manager.send_ui_command("WAIT")
        ws_manager.broadcast({
            "type": "robot_status",
            "payload": {"state": "복귀중"},
        })
        return

    if t == "robot_status":
        name = p.get("name")
        state = p.get("state", "대기중")
        robot_status_cache[name] = {"state": state}

        ws_manager.broadcast({
            "type": "robot_status",
            "payload": p,
        })
        return

    if t == "ui_command":
        from app.core.ros.ros_manager import ros_manager
        ros_manager.send_ui_command(p.get("command"))
        return
```

### app/main.py

> FastAPI 서버 진입점 # 라우터/WS/DB/ROS 라이프사이클 관리

```python
import json
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.core.database import Base, engine
from app.websocket.manager import register, unregister, handle_message
from app.core.ros.ros_manager import ros_manager

from app.routers.page_router import router as page_router
from app.routers.stock_router import router as stock_router
from app.routers.robot_router import router as robot_router
from app.routers.log_router import router as log_router
from app.routers.category_router import router as category_router
from app.routers.pin_router import router as pin_router
from app.routers.map_router import router as map_router
from app.routers.stock_csv_router import router as stock_csv_router

# FastAPI 앱 생성
app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 및 템플릿
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# API 라우터 등록
app.include_router(page_router)
app.include_router(stock_router)
app.include_router(robot_router)
app.include_router(log_router)
app.include_router(category_router)
app.include_router(pin_router)
app.include_router(map_router)
app.include_router(stock_csv_router, prefix="/stock")

# 기본 페이지
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# WebSocket 엔드포인트
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await register(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            await handle_message(websocket, msg)
    except WebSocketDisconnect:
        await unregister(websocket)

# 서버 시작 시 DB 초기화
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

# 서버 종료 시 ROS 연결 해제
@app.on_event("shutdown")
def on_shutdown():
    if ros_manager.active_robot:
        ros_manager.disconnect_robot(ros_manager.active_robot)
```

## 7️⃣ 실행

### 서버 실행
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 접속
`Web UI` : http://localhost:8000/

`Swagger` : http://localhost:8000/docs

브라우저 개발자도구(Console)에서 WebSocket 연결 로그가 보이고, 서버 콘솔에서 WebSocket 수신 로그가 찍히면 정상 동작


## ✅ 결과  

| 항목 | 설명 |
|------|------|
| ⚙️ 구조 | 로컬 환경에서 FastAPI 단일 서버로 ROS·DB·Web 통합 |
| 🌐 실시간 | ROS → FastAPI → WebSocket → Browser 즉시 반영 |
| 🧠 단순성 | EC2 / RDS / 중계 서버 없이 로컬에서 전체 동작 |
| 💡 장점 | 네트워크 독립 / 빠른 응답 / 유지보수 용이 |
| 🔋 확장성 | ROS 토픽 추가, 카메라·배터리·센서 데이터 확장 가능 |

## 📈 시스템 흐름 요약  

```
     ROS bridge
          │
          ▼
┌────────────────────────────┐
│   Local FastAPI Server     │
│----------------------------│
│  core/ros        ROS 연결  │
│  websocket       실시간 WS │
│  templates       웹 UI     │
│  database        로컬 DB   │
└────────────────────────────┘
          │
          ▼
     Web Browser
```

---

## 💡 정리

- 로컬 환경에서 ROS · DB · Web UI를 하나의 FastAPI 서버로 통합
- 오프라인 환경에서도 로봇 시뮬레이션 및 테스트 가능
- 클라우드 의존 없이 구조를 단순화하고 응답 지연 최소화
- 이후 실제 로봇, 센서, 기능 확장 시 구조 변경 없이 대응 가능