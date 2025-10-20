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