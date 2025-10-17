# Spring Boot 웹서버를 FastApi 웹서버로 변환

## **※ AWS EC2 클라우드를 사용해 서버를 배포함 (Ec2-Vscode.md 참고)**

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

**FastApi 프로젝트 기본 구조 & 환경 설정**

<details>
<summary></summary>
<div markdown="1">

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
fastapi
uvicorn
sqlalchemy
pydantic==1.10.24    # 버전 1로 설치 해야함
python-dotenv
alembic
passlib[bcrypt]
python-multipart
requests
mysqlclient
jinja2
```

| 패키지 | 설명 |
|--------|-----|
| `fastapi` | FastAPI 웹 프레임워크 |
| `uvicorn` | ASGI 서버 (FastAPI 실행) |
| `sqlalchemy` | ORM |
| `pydantic` | FastAPI의 데이터 검증 라이브러리 (fastapi가 의존) |
| `python-dotenv` | .env 파일 환경 변수 처리 |
| `alembic` | SQLAlchemy 기반 DB 마이그레이션 |
| `passlib[bcrypt]` | 비밀번호 해시 암호화 (bcrypt 포함) |
| `python-multipart` | 파일 업로드 처리 |
| `requests` | HTTP 요청 라이브러리 |
| `mysqlclient` | MySQL 드라이버 |
| `jinja2` | 템플릿 엔진 |

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
    return {"message": "FastAPI 서버 실행"}
```
---
### 실행 확인

1. 가상환경 활성화
```bash
source wms/bin/activate
```
2. 패키지 설치
```bash
python -m pip install -r requirements.txt    # 패키지 설치

python -m pip freeze > requirements.txt    # 패키지 설치 후 패키지 버전 추가
```
3. 기본 폴더 생성
```bash
mkdir -p app/core app/models app/schemas app/crud app/routers app/services app/utils app/templates app/static
```
4. 서버 실행
```bash
uvicorn app.main:app --reload
```
</div></details>

## 2. DB 모델

**Spring Boot 엔티티 → FastAPI SQLAlchemy 모델 변환**

※ Admins와 Role을 포함한 로그인 기능은 삭제

<details>
<summary></summary>
<div markdown="1">

- `Base` 상속 → SQLAlchemy 모델 기본 구조

- `__tablename__` → DB 테이블 이름

- `unique=True` → 중복 방지

- `nullable` → 필수 입력 여부

### app/models/log.py

```python
from sqlalchemy import Column, Integer, String, BigInteger, DateTime
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Log(Base):
    
    __tablename__ = "log"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 로봇 관련 정보
    robot_name = Column(String, nullable=False)  # 로봇 이름
    robot_ip = Column(String, nullable=True)     # 로봇 IP 주소 (옵션)

    # 핀 관련 정보
    pin_name = Column(String, nullable=False)    # 핀 이름
    pin_coords = Column(String, nullable=True)   # 핀 좌표 (옵션)

    # 제품 관련 정보
    product_name = Column(String, nullable=False)  # 제품 이름
    product_id = Column(BigInteger, nullable=True) # 제품 고유 ID (옵션)
    quantity = Column(Integer, nullable=False)     # 수량

    # 작업 관련 정보
    action = Column(String, nullable=False)    # 수행된 작업/행동
    operator = Column(String, nullable=True)   # 작업자 이름 (옵션)
    
    # 이벤트 발생 시간
    timestamp = Column(DateTime, nullable=False)  # 로그 발생 시각
```
---
### app/models/robot.py

```python
from sqlalchemy import Column, String, BigInteger
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Robot(Base):

    __tablename__ = "robot"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 로봇 이름
    name = Column(String, nullable=False, unique=True)  # 필수, 중복 불가

    # 로봇 IP 주소
    ip = Column(String, nullable=False)  # 필수, 네트워크 연결용
```
---
### app/models/category.py

```python
from sqlalchemy import Column, String, BigInteger
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Category(Base):

    __tablename__ = "category"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 카테고리 이름
    name = Column(String, nullable=False, unique=True)  # 필수, 중복 불가
```
---
### app/models/pin.py

```python
from sqlalchemy import Column, String, BigInteger
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Pin(Base):

    __tablename__ = "pin"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 핀 이름
    name = Column(String, nullable=False, unique=True)  # 필수, 중복 불가

    # 핀 좌표
    coords = Column(String, nullable=True)  # "x,y" 형태, 옵션 필드
```
---
### app/models/stocks.py

```python
from sqlalchemy import Column, String, Integer, BigInteger
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Stocks(Base):

    __tablename__ = "stocks"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 제품 이름
    name = Column(String, nullable=False)  # 필수 입력

    # 카테고리 정보
    category = Column(String, nullable=False)  # Category 이름 참조 (외래키로 연결 가능)

    # 핀 정보
    pin = Column(String, nullable=False)       # Pin 이름 참조 (외래키로 연결 가능)

    # 수량
    quantity = Column(Integer, nullable=False)  # 필수 입력
```
</div></details>