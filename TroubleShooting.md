## 251017

### 1. Pydantic 버전 호환 문제

서버 실행 후 오류 발생

```bash
pydantic.errors.PydanticImportError: `BaseSettings` has been moved to the `pydantic-settings` package.
```

```python
from pydantic import BaseSettings
```
`Pydantic 2.x`에서는 `BaseSettings`가 pydantic-settings 패키지로 분리

해결 방법 : `pydantic 1.x` 버전으로 다운그레이드

- 안정적이고 협업에 유리한 버전 1을 사용함

```bash
python -m pip install "pydantic<2.0"    # 다운 그레이드

python -m pip show pydantic    # 설치 확인
```

버전 확인
```bash
Name: pydantic
Version: 1.10.24
```

### **서버 실행 확인**

## 251017

### 1. 로컬에서 호스팅한 FastApi 웹서버와 RDS의 연결이 안된다는 문제점 확인

- EC2를 사용해 웹서버를 호스팅하여 RDS와 연결 - EC2에서는 ROS의 매핑, 웹캠 데이터 등 무거운 데이터 처리에 어려움 발생

- 로컬에서 ROS의 데이터를 처리 한 뒤 결과만 EC2 서버에 전달 - 데이터 처리 용이

- **결과 : ROS와 로컬을 연결하여 데이터 전처리 후 결과값만 EC2 웹서버로 전송 - RDS(DB)는 EC2 웹서버와 바로 연결**

```
┌─────────────────────────┐
│   라즈베리파이 (ROS)      │
│  /roscore, 토픽 publish  │
│  예) /odom, /camera     │
│                         │
│  ─ rosbridge / WS ─▶   │
└────────────┬────────────┘
             │
             ▼
┌────────────────────────┐
│    로컬 워커 (PC)       │
│  FastAPI or Python     │
│  토픽 구독 & 전처리      │
│  roslibpy / rospy      │
│                        │
│  ─ JSON 전처리 결과 ─▶  │
└────────────┬───────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│              EC2 (FastAPI App)           │
│  - REST API (/telemetry, /control)       │
│  - 실시간 WS (/ws/live)                   │
│  - DB 기록 및 조회                         │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────┐
│       RDS (MySQL)        │
│  - 로그 / 재고 / 상태데이터 │
│  - Alembic 마이그레이션    │
└────────────┬─────────────┘
             │
             ▼
┌────────────────────┐
│   웹 클라이언트      │
│  - 실시간 토픽값     │
│  - DB 저장값 표시    │
│  - 로봇 제어 UI      │
└────────────────────┘
```

### 개발 시작

## 251020

### 1. RDS 연결 후 테이블이 생성 안됨

- SQL에 생성한 DATABASE의 이름이 RDS의 이름과 불일치 - 이름 일치 시킨 후 작동 확인

### 문제 해결

### 2. /docs에서 테스트 시 table에 데이터가 입력이 안됨

- DB와는 정상 연결이 되었기 때문에 화면에 "[]"가 출력되지만 POST를 통해 테이블 입력시 입력값이 저장 안됨

- log_model.py에 있는 항목과 log_schema.py의 항목의 이름이 다름을 확인

```python
# models/log_model.py
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    robot_name = Column(String(100), nullable=False)
    robot_ip = Column(String(45), nullable=True)
    pin_name = Column(String(100), nullable=False)
    pin_coords = Column(String(255), nullable=True)
    category_name = Column(String(100), nullable=False)
    stock_name = Column(String(100), nullable=False)
    stock_id = Column(BigInteger, nullable=True)
    quantity = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)
    timestamp = Column(DateTime, nullable=False)
```

```python
# schemas/log_schemas.py
class LogBase(BaseModel):

    robotName: str
    robotIp: Optional[str] = None
    pinName: str
    pinCoords: Optional[str] = None
    categoryName: str
    stockName: str
    stockId: Optional[int] = None
    quantity: int
    action: str
    timestamp: datetime
```

- `model.py`는 `snake_case` / `schema.py`는 `camelCase` 사용 - `SQLAlchemy`에서는 자동 매핑 안 함

- 모든 파일을 `snake_case`로 통일

### **문제 해결**

## 251021

### 1. 로컬과 EC2 연결 안됨

