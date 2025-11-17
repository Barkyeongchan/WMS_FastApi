# 1. FastApi 서버 구축 후 ROS - 로컬 - EC2 - 웹 클라이언트 연결

## 기존의 Sprong Boot 서버에서 구축된 데이터를 FastApi 서버로 이식

<details>
<summary></summary>
<div markdown="1">

## **※ AWS EC2 클라우드를 사용해 서버를 배포함 (Ec2-Vscode.md 참고)**

## 개발 순서

1. 환경 세팅
- Python 가상환경 생성 `venv`
- `FastAPI`, `Uvicorn`, `SQLAlchemy`, `Pydantic`, `python-dotenv` 설치
- `.env` + `.gitignore` 구성
- `app/` 폴더 구조 생성 (main.py 포함)
<br><br>

2. DB 모델
- Spring의 `domain` 폴더에 있던 엔티티를 그대로 변환
- `models/` 아래에 Python ORM 모델 작성
- `core/database.py`에서 RDS 연결
- `Base.metadata.create_all()`로 테이블 생성 테스트
<br><br>

3. CRUD & Service 계층
- Spring의 `repository/` 기능을 `crud/` 폴더로 옮김
- SQLAlchemy ORM 기반의 CRUD 함수 작성
- 예: `create_stock()`, `get_logs()`, `update_robot_status()` 등
- Spring의 `@Service` 클래스 → `services/` 폴더
- 비즈니스 로직을 Python 함수로 변환
- 예: `StocksService.java` → `stock_service.py`
<br><br>

4. Router(API 엔드포인트)
- Spring의 `Controller` → FastAPI `routers/`
- 예: `/api/stocks` → `@router.get("/stocks")`
- Swagger 자동 문서화 확인 (`/docs`)
<br><br>

5. 정적 리소스 & 템플릿
- Spring `resources/templates/` → FastAPI의 `Jinja2Templates`
- 기존 JS/CSS 그대로 사용
<br><br>

6. 로컬과 WebSocket 연결
- `/ws` 엔드포인트 생성
- `WebSocket`을 통해 로컬과 연결

7. 데이터를 웹 클라이언트에 출력
- `ROS` → `로컬` → `EC2` → `웹 클라이언트` 순으로 전달
- `index.html`의 원하는 위치에 출력

## 1. 환경 세팅

**FastApi 프로젝트 기본 구조 & 환경 설정**

<details>
<summary></summary>
<div markdown="1">

### 기본 디렉토리 구조
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
uvicorn[standard]
sqlalchemy
pydantic==1.10.24    # 버전 1로 설치 해야함
python-dotenv
alembic
passlib[bcrypt]
python-multipart
requests
mysqlclient
jinja2
pymysql
```

| 패키지 | 설명 |
|--------|-----|
| `fastapi` | FastAPI 웹 프레임워크 |
| `uvicorn[standard]` | ASGI 서버 (FastAPI 실행) |
| `sqlalchemy` | ORM |
| `pydantic` | FastAPI의 데이터 검증 라이브러리 (fastapi가 의존) |
| `python-dotenv` | .env 파일 환경 변수 처리 |
| `alembic` | SQLAlchemy 기반 DB 마이그레이션 |
| `passlib[bcrypt]` | 비밀번호 해시 암호화 (bcrypt 포함) |
| `python-multipart` | 파일 업로드 처리 |
| `requests` | HTTP 요청 라이브러리 |
| `mysqlclient` | MySQL 드라이버 |
| `jinja2` | 템플릿 엔진 |
| `pymysql` | MySQL 드라이버 (Python 기반, 윈도우/리눅스 호환성 우수) |

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

1. 시스템 패키지 설치
```bash
sudo apt update

sudo apt install -y pkg-config default-libmysqlclient-dev build-essential
```
2. 가상환경 활성화
```bash
source wms/bin/activate
```
3. 패키지 설치
```bash
python -m pip install -r requirements.txt    # 패키지 설치

python -m pip freeze > requirements.txt    # 패키지 설치 후 패키지 버전 추가
```
4. 기본 폴더 생성
```bash
mkdir -p app/core app/models app/schemas app/crud app/routers app/services app/utils app/templates app/static
```
5. 서버 실행
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

## 3. CRUD & 서비스 계층

<details>
<summary></summary>
<div markdown="1">

### CRUD 스켈레톤 `app/crud/`

`app/crud/log_crud.py`

```python
from sqlalchemy.orm import Session
from app.models.log import Log

# CREATE 새로운 로그 데이터 추가
def create_log(db: Session, log_data: dict):
    log = Log(**log_data)     # 전달받은 데이터(dict)를 Log 객체로 변환
    db.add(log)               # 세션에 추가
    db.commit()               # 변경사항 저장
    db.refresh(log)           # DB 반영된 최신 데이터로 갱신
    return log


# READ 특정 로그 ID로 조회
def get_log(db: Session, log_id: int):
    return db.query(Log).filter(Log.id == log_id).first()


# READ-ALL 전체 로그 또는 일부 로그 목록 조회
def get_logs(db: Session, skip: int = 0, limit: int = 100):   # skip: 건너뛸 수, limit: 최대 조회 수
    return db.query(Log).offset(skip).limit(limit).all()


# UPDATE 로그 데이터 수정
def update_log(db: Session, log_id: int, update_data: dict):
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        return None

    for key, value in update_data.items():   # 전달받은 필드만 업데이트
        setattr(log, key, value)

    db.commit()        # 변경사항 저장
    db.refresh(log)    # 최신 상태로 갱신
    return log


# DELETE 로그 데이터 삭제
def delete_log(db: Session, log_id: int):
    log = db.query(Log).filter(Log.id == log_id).first()
    if not log:
        return None

    db.delete(log)     # 세션에서 삭제
    db.commit()        # 실제 DB에 반영
    return log
```

**같은 방식으로 `Robot`, `Pin`, `Category`, `Stock` CRUD도 각각 생성**

---
### 서비스 계층 `app/services/`
- CRUD 호출
- 비지니스 로직 처리 (재고 수량 업데이트, 입/출고 처리, 로봇 상태 확인 등)

```python
from sqlalchemy.orm import Session
from app.crud import log_crud
from app.models.log import Log

class LogService:
    
    def __init__(self, db: Session):
        self.db = db  # 데이터베이스 세션 주입 (DI 방식)

    # CREATE 로그 생성
    def create_log_entry(self, robot_name: str, pin_name: str, product_name: str,
                         quantity: int, action: str, timestamp):
        log = Log(
            robot_name=robot_name,
            pin_name=pin_name,
            product_name=product_name,
            quantity=quantity,
            action=action,
            timestamp=timestamp
        )
        return log_crud.create_log(self.db, log)

    # READ 전체 로그 조회
    def list_logs(self, skip: int = 0, limit: int = 100):
        return log_crud.get_logs(self.db, skip, limit)
```

**같은 방식으로 `Robot`, `Pin`, `Category`, `Stock` service도 각각 생성**

---
### CRUD + Service 테스트

1. `.enc`에 RDS 정보 입력
2. `main.py`에서 DB 세션 생성 후 테스트
3. 샘플 데이터를 생성하고 반환되는지 확인

```python
# app/main.py
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services.log_service import LogService

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/test_logs")
def test_logs(db: Session = Depends(get_db)):
    service = LogService(db)
    return service.list_logs()
```

- `uvicorn app.main:app --reload` 후 `/test_logs` 접속

- DB 연결 확인 가능 : `[]`출력 확인

</div></details>

## 4. API 엔드포인트 구축

**라우터를 만들고 CRUD API 완성**

<details>
<summary></summary>
<div markdown="1">

### `schemas/log_schema.py`

- API 요청/응답 구조 정의

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# 기본 로그 데이터 스키마 (공통 필드 정의)
class LogBase(BaseModel):
    # 로봇 관련 정보
    robot_name: str                      # 로봇 이름
    robot_ip: Optional[str] = None       # 로봇 IP 주소 (옵션)

    # 핀 관련 정보
    pin_name: str                        # 핀 이름
    pin_coords: Optional[str] = None     # 핀 좌표 (옵션)

    # 카테고리 및 제품 관련 정보
    category_name: str                   # 카테고리 이름
    stock_name: str                      # 제품 이름
    stock_id: Optional[int] = None       # 제품 ID (옵션)
    quantity: int                       # 수량

    # 작업 관련 정보
    action: str                         # 작업 종류 (예: 입고, 출고)

    # 로그 발생 시각
    timestamp: datetime                 # 이벤트 발생 시각


# 로그 생성 요청 시 사용 (입력용)
class LogCreate(LogBase):
    pass  # LogBase 그대로 사용, 추가 필드 없음


# 로그 수정 시 사용 (부분 업데이트 허용)
class LogUpdate(BaseModel):
    # 모든 필드는 선택적으로 수정 가능
    robot_name: Optional[str] = None
    robot_ip: Optional[str] = None
    pin_name: Optional[str] = None
    pin_coords: Optional[str] = None
    category_name: Optional[str] = None
    stock_name: Optional[str] = None
    stock_id: Optional[int] = None
    quantity: Optional[int] = None
    action: Optional[str] = None
    timestamp: Optional[datetime] = None


# 로그 조회 응답 시 사용 (출력용)
class LogResponse(LogBase):
    id: int  # 고유 ID 필드 포함

    class Config:
        orm_mode = True  # SQLAlchemy ORM 객체를 자동으로 변환 가능하게 설정
```

**같은 방식으로 `Robot`, `Pin`, `Category`, `Stock` schema도 각각 생성**

---
### `crud/log_crud.py`

```python
from sqlalchemy.orm import Session
from app.models.log import Log
from app.schemas.log_schema import LogCreate, LogUpdate


# READ-ALL 전체 로그 조회
def get_logs(db: Session):
    return db.query(Log).all()


# READ 단일 로그 조회 (ID 기준)
def get_log_by_id(db: Session, log_id: int):
    return db.query(Log).filter(Log.id == log_id).first()


# CREATE 새로운 로그 데이터 추가
def create_log(db: Session, log: LogCreate):
    db_log = Log(**log.dict())   # Pydantic 모델(LogCreate)을 SQLAlchemy 객체로 변환
    db.add(db_log)               # 세션에 추가
    db.commit()                  # 변경사항 저장
    db.refresh(db_log)           # DB 반영된 최신 상태로 갱신
    return db_log


# UPDATE 로그 데이터 수정
def update_log(db: Session, log_id: int, log_data: LogUpdate):
    db_log = db.query(Log).filter(Log.id == log_id).first()
    if not db_log:
        return None

    # 수정 요청된 필드만 갱신 (exclude_unset=True → 전달된 값만 업데이트)
    for key, value in log_data.dict(exclude_unset=True).items():
        setattr(db_log, key, value)

    db.commit()        # 변경사항 저장
    db.refresh(db_log) # 최신 상태로 갱신
    return db_log


# DELETE 로그 데이터 삭제
def delete_log(db: Session, log_id: int):
    db_log = db.query(Log).filter(Log.id == log_id).first()
    if not db_log:
        return None

    db.delete(db_log)  # 세션에서 삭제
    db.commit()        # 실제 DB 반영
    return db_log
```

### **※기존 코드와 다른 점**

- **Pydantic 스키마를 직접 사용 - FastApi가 자동으로 유효성 검사**
```python
def create_log(db: Session, log: LogCreate):
    db_log = Log(**log.dict())  # 스키마 → ORM 변환
```

- **`exclude_unset=True`로 부분 업데이트(PATCH) 지원 - 변경된 필드만 부분 수정**
```python
for key, value in log_data.dict(exclude_unset=True).items():
    setattr(db_log, key, value)
```
- **CRUD 함수 이름이 RESTful 패턴(`get_*`, `create_*`, `update_*`, `delete_*`)으로 통일**
- **FastApi 자동 문서화와 호환**
- **API - DB 사이의 데이터 무결성 확보**

**같은 방식으로 `Robot`, `Pin`, `Category`, `Stock` crud도 각각 생성**

---
### `routers/log_router.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.schemas.log_schema import LogResponse, LogCreate, LogUpdate
from app.crud import log_crud

# Logs 관련 라우터 설정
router = APIRouter(prefix="/logs", tags=["Logs"])


# DB 세션 생성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# READ-ALL 전체 로그 조회
@router.get("/", response_model=List[LogResponse])
def read_logs(db: Session = Depends(get_db)):
    return log_crud.get_logs(db)


# READ 단일 로그 조회 (ID 기준)
@router.get("/{log_id}", response_model=LogResponse)
def read_log(log_id: int, db: Session = Depends(get_db)):
    log = log_crud.get_log_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


# CREATE 새로운 로그 추가
@router.post("/", response_model=LogResponse)
def create_log(log: LogCreate, db: Session = Depends(get_db)):
    return log_crud.create_log(db, log)


# UPDATE 로그 데이터 수정
@router.put("/{log_id}", response_model=LogResponse)
def update_log(log_id: int, log_data: LogUpdate, db: Session = Depends(get_db)):
    updated = log_crud.update_log(db, log_id, log_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Log not found")
    return updated


# DELETE 로그 데이터 삭제
@router.delete("/{log_id}", response_model=LogResponse)
def delete_log(log_id: int, db: Session = Depends(get_db)):
    deleted = log_crud.delete_log(db, log_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Log not found")
    return deleted
```

**같은 방식으로 `Robot`, `Pin`, `Category`, `Stock` router도 각각 생성**

---
### `main.py` 수정

```python
from fastapi import FastAPI
from app.routers import log_router

# FastAPI 애플리케이션 생성
app = FastAPI(title="WMS FastAPI Server", version="0.2.0")

# 기본 루트 엔드포인트
@app.get("/")
def root():
    return {"message": "FastAPI 서버 실행 중"}

# Logs 라우터 등록
app.include_router(log_router.router)
```

- `# FastAPI 애플리케이션 생성` → 앱 정의

- `# 기본 루트 엔드포인트` → 서버 상태 확인용

- `# Logs 라우터 등록` → 로그 관련 API 묶음 등록
---

### 테스트 실행

1. 서버 실행 (`uvicorn app.main:app --reload`)

2. `http://127.0.0.1:8000/logs` 접속 후 출력 확인 (`[]`출력)

3. `http://127.0.0.1:8000/docs` 접속

4. `Swagger`에서 **POST /logs/** 선택 → “Try it out” 클릭

5. 요청 예시 확인
```json
{
  "robot_name": "string",
  "robot_ip": "string",
  "pin_name": "string",
  "pin_coords": "string",
  "category_name": "string",
  "stock_name": "string",
  "stock_id": 0,
  "quantity": 0,
  "action": "string",
  "timestamp": "2025-10-20T08:44:42.817Z"
}
```
6. 예시 입력
```json
{
  "robot_name": "WMS-01",
  "robot_ip": "192.168.0.10",
  "pin_name": "A-1",
  "pin_coords": "10.2, 5.7",
  "category_name": "전자부품",
  "stock_name": "IC칩 세트",
  "stock_id": 1001,
  "quantity": 25,
  "action": "입고",
  "timestamp": "2025-10-20T17:23:52"
}
```

7. `http://127.0.0.1:8000/logs`에서 확인 또는 `Swagger`에서 확인

</div></details>

## 5. 정적 파일, 템플릿 구조 세팅

**HTML 템플릿과 static 표시 (프론트엔드)**

<details>
<summary></summary>
<div markdown="1">

### 구조

```bash
├── static/                  # 정적 파일
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── images/
│       └── logo.png
│
└── templates/               # HTML 템플릿
    ├── index.html
    └── logs.html
```
---
### `templates/index.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WASD_WMS</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>

<body>
<!--헤더-->
    <header class="header"></header>

<!--메인-->
    <main>
        <div id="sidebar" class="sidebar">
            <p class="WASD">WASD</p>
            <a href="/index">대시보드</a>
            <a href="/stocks">물품 현황</a>
            <a href="#">로봇 관리</a>
            <a href="#">작업 로그</a>
            <a href="#">관리자</a>
        </div>

        <div id="main_screen" class="main_screen">

            <div class="topbar">
                <img id="togglebtn" src="/static/images/slide01.png" alt="슬라이드바">

                <div class="user_menu_wrapper">
                    <img id="user_icon" src="/static/images/user01.png" alt="유저아이콘">
                    <div id="user_menu" class="user_menu">
                        <p><strong>아이디:</strong> 예시</p>
                        <p><strong>이름:</strong> 예시</p>
                        <button id="logout_btn">로그아웃</button>
                    </div>
                </div>
            </div>

            <div class="first_line">
                <div class="order">
                    <div class="search_bar">
                        <input class="search_input" placeholder="   상품명을 입력하세요" type="text">
                        <button class="search_btn">검색</button>
                    </div>
                    <div class="buttons">
                        <button>입고</button>
                        <button>출고</button>
                    </div>
                </div>

                <div class="map">
                    <p>지도</p>
                </div>
            </div>

            <div class="second_line">
                <div class="log">
                    <p class="log_t">작업 내역</p>
                    <p class="log_text">작업 내역 나오는 곳</p>
                    <a href="/logs">로그 데이터 확인하기</a>
                </div>

                <div class="camera">
                    <p>카메라 캡쳐</p>
                </div>
            </div>
        </div>
    </main>

<!--푸터-->
    <footer></footer>

    <script src="/static/js/main.js"></script>
</body>
</html>
```

### `static/css/style.css`, `static/js/main.js`, `static/images/[이미지파일]` 추가
---

### `main.py` 수정

```python
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
```
---
### 테스트
1. 서버 실행
```bash
uvicorn app.main:app --reload
```
2. 브라우저 접속
```cpp
http://127.0.0.1:8000/
```

3. `index.html`접속 후, `/static`파일 로드 확인 

</div></details>

## 6. 로컬과 WebSocket 연결

<details>
<summary></summary>
<div markdown="1">

### `main.py`

**CORS 허용과 **

```python
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
```

</div></details>

## 7. 데이터를 웹 클라이언트에 출력

<details>
<summary></summary>
<div markdown="1">

### 전체 흐름
```markdown
┌──────────────────────────────┐
│     라즈베리파이 (ROS)         │
│  /odom, /turtle1/pose 등 발행 │
│  ─ rosbridge / WS ─▶         │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│        로컬 워커 (PC)         │
│  roslibpy로 토픽 구독         │
│  데이터 전처리 (JSON 변환)     │
│  ─ WebSocket 송신 ─▶         │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│         EC2 FastAPI 서버      │
│  /ws 엔드포인트로 데이터 수신    │
│  active_connections에 등록    │
│  ─ 모든 클라이언트에 broadcast  │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│       웹 클라이언트 (HTML)     │
│  WebSocket 연결 후 실시간 표시  │
└──────────────────────────────┘
```
---
### EC2 서버 `app/main.py`

**WebSocket 연결 관리 및 데이터 브로드캐스트**

```python
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

active_connections = []

# WebSocket 엔드포인트 추가
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)  # 연결 추가
    print("[EC2] WebSocket connected")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"[EC2] 수신 데이터 ← {data}")

            # 모든 클라이언트에 브로드캐스트
            for conn in list(active_connections):  # 복사본 사용
                try:
                    await conn.send_text(data)
                except Exception:
                    # 죽은 소켓은 제거
                    if conn in active_connections:
                        active_connections.remove(conn)

    except WebSocketDisconnect:
        print("[EC2] ❌ WebSocket disconnected")
        if websocket in active_connections:
            active_connections.remove(websocket)
        else:
            print("[EC2] ⚠️ 연결이 이미 제거되어 무시됨")
```
---
### 로컬 `ws_client.py`

**EC2 WebSocket 연결 및 데이터 전송**

```python
import websocket
import json

class WebSocketClient:
    def __init__(self, server):
        # EC2 서버(WebSocket) 주소를 초기화
        self.server = server
        self.ws = None  # WebSocket 객체 (연결 후 할당됨)

    def connect(self):
        # EC2 서버와 WebSocket 연결 시도
        self.ws = websocket.WebSocket()
        self.ws.connect(self.server)
        print(f"[EC2] Connected to {self.server}")  # 연결 성공 로그 출력

    def send(self, data: dict):
        # 서버로 JSON 데이터 전송
        try:
            self.ws.send(json.dumps(data))  # dict → JSON 문자열로 변환 후 전송
            print("[SEND] →", data)  # 전송 로그
        except websocket.WebSocketConnectionClosedException:
            # 연결이 끊어진 경우 자동 재연결 시도
            print("[WARN] WebSocket closed, reconnecting...")
            try:
                self.connect()  # 재연결
                self.ws.send(json.dumps(data))  # 재전송
                print("[SEND-RETRY] →", data)  # 재전송 로그
            except Exception as e:
                # 재연결 시도 실패 시 출력
                print("[ERROR] WebSocket send retry failed:", e)
        except Exception as e:
            # 전송 실패 시 예외 처리 및 에러 출력
            print("[ERROR] WebSocket send failed:", e)
```
---
### 웹 클라이언트 `static/js/main.js`

**WebSocket 연결 및 실시간 데이터 표시**

```js
console.log("WMS Dashboard JS Loaded");

    // EC2 WebSocket 연결 (pose 데이터 표시)
    const ws = new WebSocket("ws://" + window.location.host + "/ws");

    ws.onopen = () => {
        console.log("[CLIENT] ✅ WebSocket connected to EC2");
    };

    ws.onmessage = (event) => {
        console.log("[CLIENT] Received:", event.data);

        try {
            const data = JSON.parse(event.data);
            const poseEl = document.querySelector(".log_text");
            poseEl.innerText =
                `X: ${data.x}, Y: ${data.y}, θ: ${data.theta}, ` +
                `Linear: ${data.linear_velocity}, Angular: ${data.angular_velocity}`;
        } catch {
            console.warn("[CLIENT] Non-JSON message:", event.data);
        }
    };

    ws.onclose = () => {
        console.warn("[CLIENT] WebSocket disconnected");
    };

    ws.onerror = (error) => {
        console.error("[CLIENT] WebSocket error:", error);
    };
```
---
### `index.html` 데이터 표시 위치
```html
<div class="log">
    <p class="log_t">작업 내역</p>
    <p class="log_text">작업 내역 나오는 곳</p>    <!--여기에 출력-->
</div>
```
---
### 작동 확인

**1. EC2 서버 실행**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
**2. 로컬에서 main.py 실행**
```bash
python main.py
```
**3. 웹 클라이언트 접속**
```bash
http://<EC2_IP>:8000
```
**4. 브라우저 콘솔 확인**
```css
[CLIENT] ✅ WebSocket connected to EC2
```
**5. 실시간 데이터 출력 확인**
```
X: 1, Y: 6, θ: -2, Linear: 0, Angular: 0
```
</div></details>
</div></details>
<br><br>

# 2. 웹 클라이언트에서 ROS로 명령 송신 후 결과 재수신

<details>
<summary></summary>
<div markdown="1">

## 1. 데이터 업데이트 주기 제어

<details>
<summary></summary>
<div markdown="1">

**데이터의 송수신을 제한하여 서버의 부화를 줄임**

### 로컬 `main.py`

**변화 감지, 주기 제한 적용**

```python
from ros_listener import RosListener
from ws_client import WebSocketClient
import os
from dotenv import load_dotenv
import time  # 프로그램 유지용

# .env 파일 로드 (환경 변수 불러오기)
load_dotenv()

# 환경 변수 설정
ROS_HOST = os.getenv("ROS_HOST")      # ROS 브리지 서버 IP
ROS_PORT = int(os.getenv("ROS_PORT")) # ROS 브리지 포트 (예: 9090)
EC2_WS = os.getenv("EC2_WS")          # EC2 WebSocket 서버 주소

last_send_time = 0  # 최근 전송 시각
last_data = None    # 최근 전송 데이터

def main():
    # ROS → EC2 데이터 중계 메인 프로세스
    
    # EC2 WebSocket 클라이언트 연결
    ws = WebSocketClient(EC2_WS)
    ws.connect()

    # ROS 데이터 수신 콜백
    def on_ros_data(data):
        global last_send_time, last_data, first_sent  # 마지막 전송 시간, 데이터 추적, 초기값 전송여부 확인
        current_time = time.time()

        # 데이터가 바뀌었거나 0.5초 이상 지났을 때만 전송
        if data != last_data and current_time - last_send_time > 0.5:
            ws.send(data)                  # EC2로 데이터 전송
            last_data = data               # 최근 전송 데이터 갱신
            last_send_time = current_time  # 최근 전송 시각 갱신

    # ROS 리스너 연결 및 토픽 구독
    ros = RosListener(ROS_HOST, ROS_PORT, callback=on_ros_data)
    ros.connect()
    ros.subscribe('/turtle1/pose')  # 구독할 토픽 이름

    # 프로그램 종료 방지 (ROS 메시지 수신 대기)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass

# 직접 실행 시 main() 실행
if __name__ == "__main__":
    main()
```
---
### EC2 `app/main.py`

**클라이언트가 처음 접속 시 `init_request` 메시지를 보내면 `latest_data`를 즉시 반환**

**- 초기 상태를 브라우저에 표시**

```python
latest_data = None  # 최근 수신 데이터 저장용

if data == "init_request" and latest_data:
    await websocket.send_text(latest_data)
    print("[EC2] 초기 데이터 전송 → 클라이언트")
    continue
```

_**전체 코드**_

```python
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
```
---
### EC2 `static/js/main.js`

**서버에 초기 데이터를 요청하고 화면에 표시하도록 유지**

```js
ws.onopen = () => {
    console.log("[CLIENT] ✅ WebSocket connected to EC2");
    ws.send("init_request");  // 초기 데이터 요청
    console.log("[CLIENT] 초기 데이터 요청 전송");
};
```

_**전체 코드**_

```js
document.addEventListener('DOMContentLoaded', () => {

    const toggleBtn = document.getElementById("togglebtn");
    const sidebar = document.getElementById("sidebar");
    const mainScreen = document.getElementById("main_screen");
    const userIcon = document.getElementById("user_icon");
    const userMenu = document.getElementById("user_menu");
    const poseOutput = document.getElementById("pose_output"); // pose 표시 위치

    // 사이드바 슬라이드
    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("closed");
        mainScreen.classList.toggle("expanded");
    });

    // 유저 메뉴 토글
    userIcon.addEventListener("click", () => {
        userMenu.style.display = userMenu.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (event) => {
        if (!userIcon.contains(event.target) && !userMenu.contains(event.target)) {
            userMenu.style.display = "none";
        }
    });

    console.log("WMS Dashboard JS Loaded");

    // EC2 WebSocket 연결 (pose 데이터 표시)
    const ws = new WebSocket("ws://" + window.location.host + "/ws");

    // 연결 성공 시
    ws.onopen = () => {
        console.log("[CLIENT] ✅ WebSocket connected to EC2");

        // 서버에 초기 데이터 요청
        ws.send("init_request");
        console.log("[CLIENT] 초기 데이터 요청 전송");
    };

    // 서버로부터 메시지 수신 시
    ws.onmessage = (event) => {
        console.log("[CLIENT] Received:", event.data);

        try {
            const data = JSON.parse(event.data);
            const poseEl = document.querySelector(".log_text");

            // pose 값 표시
            poseEl.innerText =
                `X: ${data.x}, Y: ${data.y}, θ: ${data.theta}, ` +
                `Linear: ${data.linear_velocity}, Angular: ${data.angular_velocity}`;
        } catch {
            console.warn("[CLIENT] Non-JSON message:", event.data);
        }
    };

    // 연결 종료
    ws.onclose = () => {
        console.warn("[CLIENT] WebSocket disconnected");
    };

    // 오류 발생 시
    ws.onerror = (error) => {
        console.error("[CLIENT] WebSocket error:", error);
    };
});
```
</div></details>

## 웹 클라이언트 → ROS 데이터 흐름

```markdown
┌──────────────────────────────┐
│       웹 클라이언트 (HTML)     │
│  키보드/버튼 입력 발생          │
│  ─ WebSocket 송신 ─▶         │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│        EC2 FastAPI 서버       │
│  /ws 엔드포인트에서 데이터 수신  │
│  active_connections에 등록    │
│  ─ 로컬 워커로 브로드캐스트 ─▶  │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│         로컬 워커 (PC)         │
│  WebSocket으로 명령 수신        │
│  roslibpy로 /turtle1/cmd_vel 퍼블리시 │
│  ─ ROS로 명령 전송 ─▶          │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│      라즈베리파이 (ROS)        │
│  /turtle1/cmd_vel 토픽 구독    │
│  로봇(거북이) 실제 이동 수행     │
└──────────────────────────────┘
```
---
### 데이터 흐름 (웹 → ROS)

웹 클라이언트에서 입력한 키보드/버튼 신호가 ROS 시스템으로 전달되는 전체 과정:

1. **웹 클라이언트**  
- 사용자의 입력(방향키/버튼)을 감지  
- JSON 형태로 WebSocket을 통해 EC2로 전송

2. **EC2 FastAPI 서버**  
- `/ws` 엔드포인트에서 메시지 수신  
- `active_connections` 리스트에 등록된 모든 클라이언트(로컬 워커 포함)로 브로드캐스트

3. **로컬 워커 (PC)**  
- EC2에서 전송된 메시지를 WebSocket으로 수신  
- 메시지 타입이 `"control"`일 경우 roslibpy를 통해  
  `/turtle1/cmd_vel` 토픽에 퍼블리시

4. **라즈베리파이 (ROS)**  
- `/turtle1/cmd_vel` 토픽을 구독  
- 거북이 시뮬레이터(turtlesim)가 실제로 움직임 수행

## 메세지 포멧 단일화

### 웹 클라이언트 → EC2 → 로컬 (제어)
```json
// 예시
{
  "type": "control",
  "topic": "/turtle1/cmd_vel",
  "linear_x": 2.0,
  "angular_z": 1.0
}
```
---
### 로컬 → EC2 → 웹 클라이언트 (텔레메트리)
```json
// 예시
{
  "type": "turtle_pose",
  "x": 4,
  "y": 11,
  "theta": 2,
  "linear_velocity": 0,
  "angular_velocity": 0
}
```

## 2. 웹 → ROS 명령 송신 구조 생성

<details>
<summary></summary>
<div markdown="1">

### 웹 클라이언트 `main.js`

**웹에서 방향키 입력 감지 - 제어 명령(JSON)을 EC2로 전송**

```js
// 키보드 입력 감지 (방향키로 제어)
document.addEventListener("keydown", (event) => {
    let cmd = null;

    switch (event.key) {
        case "ArrowUp":
            cmd = { type: "control", command: "up" };
            break;
        case "ArrowDown":
            cmd = { type: "control", command: "down" };
            break;
        case "ArrowLeft":
            cmd = { type: "control", command: "left" };
            break;
        case "ArrowRight":
            cmd = { type: "control", command: "right" };
            break;
    }

    if (cmd && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(cmd));
        console.log("[CLIENT] →", cmd);
    }
});
```

_**전체 코드**_

```js
document.addEventListener('DOMContentLoaded', () => {

    const toggleBtn = document.getElementById("togglebtn");
    const sidebar = document.getElementById("sidebar");
    const mainScreen = document.getElementById("main_screen");
    const userIcon = document.getElementById("user_icon");
    const userMenu = document.getElementById("user_menu");
    const poseOutput = document.getElementById("pose_output"); // pose 표시 위치

    // 사이드바 슬라이드
    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("closed");
        mainScreen.classList.toggle("expanded");
    });

    // 유저 메뉴 토글
    userIcon.addEventListener("click", () => {
        userMenu.style.display = userMenu.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (event) => {
        if (!userIcon.contains(event.target) && !userMenu.contains(event.target)) {
            userMenu.style.display = "none";
        }
    });

    console.log("WMS Dashboard JS Loaded");

    // EC2 WebSocket 연결 (pose 데이터 표시)
    const ws = new WebSocket("ws://" + window.location.host + "/ws");

    // 연결 성공 시
    ws.onopen = () => {
        console.log("[CLIENT] ✅ WebSocket connected to EC2");

        // 서버에 초기 데이터 요청
        ws.send("init_request");
        console.log("[CLIENT] 초기 데이터 요청 전송");
    };

    // 서버로부터 메시지 수신 시
    ws.onmessage = (event) => {
        console.log("[CLIENT] Received:", event.data);

        try {
            const data = JSON.parse(event.data);
            const poseEl = document.querySelector(".log_text");

            // pose 값 표시
            poseEl.innerText =
                `X: ${data.x}, Y: ${data.y}, θ: ${data.theta}, ` +
                `Linear: ${data.linear_velocity}, Angular: ${data.angular_velocity}`;
        } catch {
            console.warn("[CLIENT] Non-JSON message:", event.data);
        }
    };

    // 연결 종료
    ws.onclose = () => {
        console.warn("[CLIENT] WebSocket disconnected");
    };

    // 오류 발생 시
    ws.onerror = (error) => {
        console.error("[CLIENT] WebSocket error:", error);
    };

    // 키보드 입력 감지 (방향키로 ROS 제어 명령 전송)
    document.addEventListener("keydown", (event) => {
        let cmd = null;

        switch (event.key) {
            case "ArrowUp":
                cmd = { type: "control", command: "up" };
                break;
            case "ArrowDown":
                cmd = { type: "control", command: "down" };
                break;
            case "ArrowLeft":
                cmd = { type: "control", command: "left" };
                break;
            case "ArrowRight":
                cmd = { type: "control", command: "right" };
                break;
        }

        // WebSocket 연결이 유지 중일 때만 전송
        if (cmd && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(cmd));
            console.log("[CLIENT] →", cmd);
        }
    });
});
```
---
### 로컬 새 파일 추가 `utils/ros_publisher.py`

**명령을 감지하고 ROS로 퍼블리시**

```python
import roslibpy

class RosPublisher:
    def __init__(self, host, port):
        self.ros = roslibpy.Ros(host=host, port=port)
        self.ros.run()
        print("[ROS] Connected to rosbridge")

        self.pub = roslibpy.Topic(self.ros, '/turtle1/cmd_vel', 'geometry_msgs/Twist')

    def publish_command(self, cmd):
        twist = {'linear': {'x': 0.0, 'y': 0.0, 'z': 0.0},
                 'angular': {'x': 0.0, 'y': 0.0, 'z': 0.0}}

        if cmd == "up":
            twist['linear']['x'] = 1.0
        elif cmd == "down":
            twist['linear']['x'] = -1.0
        elif cmd == "left":
            twist['angular']['z'] = 1.0
        elif cmd == "right":
            twist['angular']['z'] = -1.0

        self.pub.publish(roslibpy.Message(twist))
        print(f"[ROS] 퍼블리시 → {cmd}")
```

