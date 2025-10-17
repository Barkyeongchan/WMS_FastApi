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
