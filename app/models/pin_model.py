from sqlalchemy import Column, String, BigInteger
from sqlalchemy.orm import relationship
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Pin(Base):
    __tablename__ = "pin"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 핀 이름
    name = Column(String(100), nullable=False, unique=True)  # 필수, 중복 불가

    # 핀 좌표
    coords = Column(String(255), nullable=True)  # "x,y" 형태, 옵션 필드

    # 역참조 (Stock.pin 연결)
    stocks = relationship("Stock", back_populates="pin")