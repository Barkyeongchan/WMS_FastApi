from sqlalchemy.orm import Session
from app.crud import category_crud
from app.models.category import Category

class CategoryService:
    """
    카테고리(Category) 관련 비즈니스 로직을 관리하는 서비스 클래스
    """
    def __init__(self, db: Session):
        self.db = db

    # CREATE 카테고리 추가
    def create_category(self, name: str, description: str = None):
        category = Category(name=name, description=description)
        return category_crud.create_category(self.db, category)

    # READ 카테고리 목록 조회
    def list_categories(self, skip: int = 0, limit: int = 100):
        return category_crud.get_categories(self.db, skip, limit)