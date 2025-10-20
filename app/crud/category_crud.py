from sqlalchemy.orm import Session
from app.models.category_model import Category

# CREATE 새로운 카테고리 추가
def create_category(db: Session, category_data: dict):
    category = Category(**category_data)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


# READ 특정 카테고리 ID로 조회
def get_category(db: Session, category_id: int):
    return db.query(Category).filter(Category.id == category_id).first()


# READ-ALL 전체 카테고리 목록 조회
def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Category).offset(skip).limit(limit).all()


# UPDATE 카테고리 데이터 수정
def update_category(db: Session, category_id: int, update_data: dict):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        return None

    for key, value in update_data.items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


# DELETE 카테고리 데이터 삭제
def delete_category(db: Session, category_id: int):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        return None

    db.delete(category)
    db.commit()
    return category