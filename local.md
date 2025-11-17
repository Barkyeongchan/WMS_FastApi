💻 README_LOCAL.md — 로컬 통합형 FastAPI 버전
# 🚀 FastAPI 로컬 서버 구축 및 ROS → 웹 클라이언트 실시간 연결  

## 1️⃣ 개요  

### 전체 흐름  

ROS → Local FastAPI (roslibpy 통합) → WebClient(JavaScript)

- EC2, RDS, 중계 프로그램 없이 **하나의 FastAPI 서버**만으로 ROS·DB·WebSocket·UI 통합
- 인터넷 연결 없이도 완전 동작 (오프라인 시뮬레이션 가능)
- 구조 단순화, 유지보수 용이성, 지연 최소화  

---

## 2️⃣ 폴더 구조  

```
WMS_FastApi/
├── .env
├── requirements.txt
└── app/
    ├── main.py
    ├── core/
    │   ├── config.py
    │   ├── database.py
    │   └── ros/
    │       └── ros_manager.py
    ├── websocket/
    │   ├── manager.py
    │   └── handler.py
    ├── routers/
    │   └── robot_router.py
    ├── templates/
    │   └── robot.html
    └── static/
        └── js/
            └── robot.js
```

---

## 3️⃣ .env (환경 변수 설정)
```bash
# .env
DB_USER=root
DB_PASSWORD=1234
DB_HOST=localhost
DB_PORT=3306
DB_NAME=wms_fastapi
SERVER_PORT=8000
DEBUG=True
ROS_HOST=192.168.1.47
ROS_PORT=9090
```

.env 파일로 ROS 브릿지, DB, 서버 포트를 한 곳에서 통합 제어 가능  

---

## 4️⃣ 가상환경 및 패키지 설치  

🧱 가상환경 생성
```bash
python -m venv wms
source wms/bin/activate     # macOS / Linux
wms\Scripts\activate        # Windows PowerShell
```

📦 필수 패키지 설치
```bash
pip install fastapi uvicorn[standard] sqlalchemy mysqlclient pydantic==1.10.24 python-dotenv jinja2 roslibpy
```

- `roslibpy`: ROS 브릿지(WebSocket 기반) 연결  
- `pydantic==1.10.24`: FastAPI 2.x 호환 버전  
- `mysqlclient`: MariaDB 드라이버  

---

## 5️⃣ FastAPI 핵심 구성  

| 파일 | 역할 |
|------|------|
| core/config.py | 환경 변수 로드 (settings) |
| core/database.py | 로컬 DB 연결 |
| core/ros/ros_manager.py | ROS 연결/해제 관리 |
| websocket/manager.py | WebSocket 브로드캐스트 관리 |
| routers/robot_router.py | 로봇 CRUD 및 연결 API |
| static/js/robot.js | 클라이언트 WebSocket 연결 |
| main.py | FastAPI 서버 진입점 |

---

## 6️⃣ 주요 코드 예시  

### app/core/config.py
```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    SERVER_PORT: int
    DEBUG: bool
    ROS_HOST: str
    ROS_PORT: int

    class Config:
        env_file = ".env"

settings = Settings()
```

---

### app/core/database.py
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

DB_URL = f"mysql+mysqlclient://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
engine = create_engine(DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

---

### app/core/ros/ros_manager.py
```python
import roslibpy
import threading
import time

class RosManager:
    def __init__(self, host, port):
        self.client = roslibpy.Ros(host=host, port=port)
        self.connected = False

    def connect(self):
        self.client.run()
        while not self.client.is_connected:
            time.sleep(0.2)
        self.connected = True
        print("[ROS] 연결 성공 ✅")

    def disconnect(self):
        if self.client.is_connected:
            self.client.terminate()
        self.connected = False
        print("[ROS] 연결 해제 ❌")
```

---

### app/websocket/manager.py
```python
from fastapi import WebSocket

connections = []

async def register(ws: WebSocket):
    await ws.accept()
    connections.append(ws)
    print(f"[WS] 연결됨 (총 {len(connections)}명)")

async def unregister(ws: WebSocket):
    if ws in connections:
        connections.remove(ws)
    print(f"[WS] 연결 해제됨 (총 {len(connections)}명)")

async def broadcast_json(data: dict):
    for ws in list(connections):
        try:
            await ws.send_json(data)
        except:
            await unregister(ws)
```

---

### app/main.py
```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.websocket.manager import register, unregister, broadcast_json
from app.core.database import Base, engine

app = FastAPI(title="WASD WMS FastAPI (Local)")

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    print("✅ DB 테이블 자동 생성 완료")

@app.get("/")
async def root():
    return {"message": "Local FastAPI 서버 정상 실행 중"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await register(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await broadcast_json({"message": data})
    except WebSocketDisconnect:
        await unregister(websocket)
```

---

### app/static/js/robot.js
```javascript
const ws = new WebSocket("ws://localhost:8000/ws");

ws.onopen = () => console.log("[WS] 연결 성공 ✅");
ws.onmessage = (e) => console.log("[WS 수신]", e.data);
ws.onclose = () => console.warn("[WS] 연결 종료 ❌");
```

---

## 7️⃣ 실행  

### 터미널 명령
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 접속
http://localhost:8000

콘솔에서 `[WS 연결 성공]` 출력 시 정상 작동

---

## ✅ 결과  

| 항목 | 설명 |
|------|------|
| ⚙️ 구조 | 완전한 로컬 통합형 FastAPI 서버 |
| 🌐 실시간 | ROS → FastAPI → WebSocket → Browser 즉시 반영 |
| 🧠 단순성 | EC2, RDS, Bridge 불필요 |
| 💡 장점 | 네트워크 독립 / 빠른 응답 / 유지보수 용이 |
| 🔋 확장성 | ROS 토픽 구독, 카메라 스트림, 배터리 등 확장 가능 |

---

## 📈 시스템 흐름 요약  

```
┌────────────────────────────┐
│   Local FastAPI Server     │
│----------------------------│
│  /core/ros → ROS 연결 관리   │
│  /websocket → 실시간 전송     │
│  /templates → 웹 대시보드     │
│  /database → 로컬 DB 저장     │
└────────────────────────────┘
          │
          ▼
     [Web Browser]
```

---

## 💡 총평  

✅ 오프라인에서도 완전한 테스트 가능  
✅ 하나의 FastAPI 서버로 ROS·DB·Web UI 통합  
✅ EC2·RDS·Bridge 제거로 단순화 및 속도 향상  
✅ ROS 확장 기능 추가 시 최소한의 수정으로 적용 가능
