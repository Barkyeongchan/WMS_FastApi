# WASD WMS FastAPI Server

본 프로젝트는 ROS 기반 자율주행 로봇과 웹 클라이언트를  
로컬 환경에서 실시간으로 연결하기 위한 **WMS(Warehouse Management System) 서버**

FastAPI를 기반으로 REST API와 WebSocket을 제공하며,  
재고 관리, 로봇 작업 명령, 로봇 상태 모니터링을 통합적으로 처리

현재 시스템은 **클라우드 없이 로컬 환경**에서 동작

## 1️⃣ 프로젝트 개요

- 웹 클라이언트에서 재고 입·출고 작업 요청
- 서버에서 작업 요청을 관리하고 로봇에 전달
- ROS(rosbridge)를 통해 로봇 상태 및 센서 데이터 수신
- WebSocket을 통해 웹 UI에 실시간 상태 반영

## 2️⃣ 전체 시스템 구조

```text
Web Client
  ↕ (REST / WebSocket)
FastAPI Server (Local)
  ↕ (rosbridge / WebSocket)
ROS Robot / Simulator
```

- **Web Client**
  - 작업 요청
  - 로봇 상태 및 재고 현황 표시

- **FastAPI Server**
  - REST API 제공
  - WebSocket 브로드캐스트
  - DB 처리

- **ROS**
  - 로봇 제어
  - 센서 및 상태 데이터 송신

## 3️⃣ 서버 아키텍처

- **FastAPI**
  - 재고 / 로봇 / 로그 REST API
  - WebSocket 엔드포인트(`/ws`) 운영

- **WebSocket Manager**
  - 다중 클라이언트 연결 관리
  - 로봇 상태, 로그 이벤트 브로드캐스트

- **ROS Manager**
  - ROS 토픽 구독 및 퍼블리시
  - 로봇 연결 상태 관리
  - roslibpy 기반 통신

- **Database (MariaDB / MySQL)**
  - 재고, 로봇, 작업 로그 저장
  - SQLAlchemy ORM 사용
  - Alembic 마이그레이션 관리

## 4️⃣ 디렉터리 구조

```text
app/
├── core/
│   ├── message/          # ROS ↔ 서버 메시지 가공
│   │   ├── controller.py
│   │   ├── data_processor.py
│   │   └── message_builder.py
│   ├── ros/              # ROS 통신 관리
│   │   ├── listener.py
│   │   ├── publisher.py
│   │   └── ros_manager.py
│   ├── config.py         # 환경 설정
│   └── database.py       # DB 연결
│
├── crud/                 # DB CRUD 로직
├── models/               # SQLAlchemy 모델
├── routers/              # FastAPI API 라우터
├── schemas/              # Pydantic 스키마
├── services/             # 비즈니스 로직
│
├── websocket/
│   └── manager.py        # WebSocket 연결 관리
│
├── static/               # CSS / JS / 이미지
├── templates/            # HTML 템플릿
└── main.py               # FastAPI 엔트리포인트
```

## 5️⃣ 실행 방법

### 1) 가상환경 생성 및 활성화

```bash
python -m venv venv
```

```bash
# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 2) 패키지 설치

```bash
pip install -r requirements.txt
```

### 3) 환경 변수 설정 (.env)

```bash
# DB (Local MariaDB / MySQL)
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=wasd_wms

# Server
SERVER_PORT=8000
DEBUG=True

# ROS (rosbridge)
ROS_HOST=127.0.0.1
ROS_PORT=9090
```

### 4) 서버 실행

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Web UI: `http://localhost:8000/`
- Swagger: `http://localhost:8000/docs`

## 6️⃣ 주요 기능

- 재고 입고 / 출고 관리
- 로봇 작업 명령 요청
- 작업 로그 기록 및 조회
- 로봇 연결 상태 모니터링
- 로봇 위치, 속도, 배터리 상태 실시간 수신
- WebSocket 기반 UI 실시간 동기화

## 7️⃣ WebSocket & ROS 연동

### ROS Listener
- `/odom`
- `/battery_state`
- `/amcl_pose`
- 기타 로봇 상태 토픽

수신 데이터는 서버 내부에서 공통 메시지 포맷으로 변환 후 처리됩니다.

### ROS Publisher
- 웹 UI에서 전달된 명령을 ROS 토픽으로 퍼블리시
- 로봇 이동, 작업 명령 처리

### WebSocket
- `/ws` 엔드포인트 사용
- 로봇 상태, 작업 결과, 로그 이벤트 실시간 전송
- 연결된 모든 클라이언트에 브로드캐스트

## 8️⃣ 개발 환경

- Python 3.10
- FastAPI
- SQLAlchemy / Alembic
- MariaDB(MySQL) – Local
- ROS2 + rosbridge
- HTML / CSS / Vanilla JavaScript

> 전체 로컬 아키텍처 및 실행 구조는  
> [`ARCHITECTURE_LOCAL_FASTAPI.md`](./ARCHITECTURE_LOCAL_FASTAPI.md)를 참고하세요.
