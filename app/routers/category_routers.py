# app/routers/category_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.models.category import Category
from app.schemas.category_schema import CategoryResponse, CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])

# DB 세션 생성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# READ-ALL 전체 카테고리 조회
@router.get("/", response_model=List[CategoryResponse])
def read_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

# READ 단일 카테고리 조회
@router.get("/{category_id}", response_model=CategoryResponse)
def read_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

# CREATE 카테고리 생성
@router.post("/", response_model=CategoryResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    db_category = Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

# UPDATE 카테고리 수정
@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, update_data: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category

# DELETE 카테고리 삭제
@router.delete("/{category_id}", response_model=CategoryResponse)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()
    return category