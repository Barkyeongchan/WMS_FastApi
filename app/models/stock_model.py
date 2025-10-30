from sqlalchemy import Column, String, Integer, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Stock(Base):
    __tablename__ = "stock"  # DB 테이블명 지정

    # 고유 ID, 자동 증가
    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # 제품 이름
    name = Column(String(100), nullable=False)  # 필수 입력

    # 수량
    quantity = Column(Integer, nullable=False)  # 필수 입력

    # 카테고리 FK (Category.id 참조)
    category_id = Column(BigInteger, ForeignKey("category.id"), nullable=False)

    # 핀 FK (Pin.id 참조)
    pin_id = Column(BigInteger, ForeignKey("pin.id"), nullable=False)

    # relationship — 조인 시 사용 (카테고리/핀 객체 접근)
    category = relationship("Category", back_populates="stocks")
    pin = relationship("Pin", back_populates="stocks")