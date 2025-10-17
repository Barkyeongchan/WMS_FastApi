# Spring Boot 웹서버를 FastApi 웹서버로 변환

## 개발 순서

1. 환경 세팅
- Python 가상환경 생성 `venv`
- FastAPI, Uvicorn, SQLAlchemy, Pydantic, python-dotenv 설치
- `.env` + `.gitignore` 구성
- `app/` 폴더 구조 생성 (main.py 포함)
<br><br>

2. DB 모델
- Spring의 `domain` 폴더에 있던 엔티티를 그대로 변환
- `models/` 아래에 Python ORM 모델 작성
- `core/database.py`에서 RDS 연결
- `Base.metadata.create_all()`로 테이블 생성 테스트
<br><br>

3. CRUD 레이어
- Spring의 `repository/` 기능을 `crud/` 폴더로 옮김
- SQLAlchemy ORM 기반의 CRUD 함수 작성
- 예: `create_stock()`, `get_logs()`, `update_robot_status()` 등
<br><br>

4. Service 계층
- Spring의 `@Service` 클래스 → `services/` 폴더
- 비즈니스 로직을 Python 함수로 변환
- 예: `StocksService.java` → `stock_service.py`
<br><br>

5. Router(API 엔드포인트)
- Spring의 `Controller` → FastAPI `routers/`
- 예: `/api/stocks` → `@router.get("/stocks")`
- Swagger 자동 문서화 확인 (`/docs`)
<br><br>

6. WebSocket + ROS 연동
- 기존 `WebSocketServer.java`, `RosBridgeClient.java` 이식
- FastAPI의 `WebSocket` 객체로 ROS bridge 연결
- ROS 메시지 → FastAPI WebSocket → 브라우저 송수신
<br><br>

7. 정적 리소스 & 템플릿
- Spring `resources/templates/` → FastAPI의 `Jinja2Templates`
- 기존 JS/CSS 그대로 사용
<br><br>

8. 환경 설정 & 실행
- `.env` + `config.py`로 환경 변수 관리
- `uvicorn app.main:app --reload` 실행
- Swagger + DB 연결 + WebSocket 확인
<br><br>

## 1. 환경 세팅

### 기본 폴더 구조
```markdown
WMS_FastApi/
│
├── .env
├── .gitignore
├── requirements.txt
├── README.md
│
└── app/
    ├── main.py
    │
    ├── core/
    │   ├── __init__.py
    │   ├── config.py
    │   └── database.py
    │
    ├── models/
    │   └── __init__.py
    │
    ├── crud/
    │   └── __init__.py
    │
    ├── services/
    │   └── __init__.py
    │
    ├── routers/
    │   └── __init__.py
    │
    ├── schemas/
    │   └── __init__.py
    │
    ├── websocket/
    │   └── __init__.py
    │
    ├── templates/
    └── static/
```
---
### .gitignore

**가상환경, 캐시, 민감파일 제외**

```gitignore
# Python bytecode
__pycache__/
*.py[cod]
*$py.class

# Virtual environment
wms/
venv/
.env

# VS Code
.vscode/

# Logs
*.log

# OS
.DS_Store
Thumbs.db

# SQLite (필요시 제외)
*.db
```
---
### requirements.txt

**FastApi 서버 구동에 필요한 패키지 (MySql 기준)**

```txt
aiohappyeyeballs==2.6.1
aiohttp==3.13.0
aiosignal==1.4.0
annotated-types==0.7.0
anyio==4.11.0
async-timeout==5.0.1
attrs==25.4.0
click==8.3.0
colorama==0.4.6
exceptiongroup==1.3.0
fastapi==0.119.0
frozenlist==1.8.0
greenlet==3.2.4
h11==0.16.0
idna==3.11
Jinja2==3.1.6
MarkupSafe==3.0.3
multidict==6.7.0
propcache==0.4.1
psycopg2-binary==2.9.11
pydantic==2.12.2
pydantic_core==2.41.4
python-multipart==0.0.20
sniffio==1.3.1
SQLAlchemy==2.0.44
starlette==0.48.0
typing-inspection==0.4.2
typing_extensions==4.15.0
uvicorn==0.37.0
websockets==15.0.1
yarl==1.22.0
```
---
### .env

**RDS 접속 정보 (초기는 더미 값)**

```bash
DB_USER=root
DB_PASSWORD=password
DB_HOST=db-host.rds.amazonaws.com
DB_PORT=3306
DB_NAME=wms
SERVER_PORT=8000
DEBUG=True
```
---
### app/care/config.py

**환경 변수 로딩 및 전역 설정 파일**

**`.env`를 Python에서 사용할 수 있게 함**

```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    SERVER_PORT: int
    DEBUG: bool = True

    class Config:
        env_file = ".env"

settings = Settings()
```
---
### app/core/database.py

**SQLAlchemy 연결 세팅**

- Spring `application.properties` + `JpaConfig` 대체

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

DB_URL = (
    f"mysql+mysqlclient://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)

engine = create_engine(DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```
---
### app/main.py

**FastApi 메인**

- Spring의 `Application.java` 대체

```python
from fastapi import FastAPI
from app.core.config import settings

app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

@app.get("/")
def root():
    return {"message": "WMS FastAPI Server Running"}
```