from sqlalchemy import Column, String, Integer, BigInteger
from app.core.database import Base  # SQLAlchemy Base 클래스, 모든 모델은 이 클래스를 상속해야 함

class Stocks(Base):

    __tablename__ = "stock"  # DB 테이블명 지정

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