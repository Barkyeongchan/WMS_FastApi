from sqlalchemy import Column, String, BigInteger
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Robot(Base):

    __tablename__ = "robot"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 로봇 이름
    name = Column(String(100), nullable=False, unique=True)  # 필수, 중복 불가

    # 로봇 IP 주소
    ip = Column(String(45), nullable=False)  # 필수, 네트워크 연결용