from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.category_model import Category
from app.models.stock_model import Stock
from app.schemas.category_schema import CategoryResponse, CategoryCreate
from app.models.log_model import Log
from app.schemas.log_schema import LogCreate
from app.crud import log_crud

router = APIRouter(prefix="/categories", tags=["Categories"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[CategoryResponse])
def read_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()


@router.post("/", response_model=CategoryResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    new_category = Category(**category.dict())
    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    log_crud.create_log(
        db,
        LogCreate(
            robot_name="-",
            robot_ip=None,
            pin_name="-",
            pin_coords=None,
            category_name=new_category.name,
            stock_name="-",
            stock_id=None,
            quantity=0,
            action="카테고리 등록",
            timestamp=datetime.now(timezone(timedelta(hours=9))),
        ),
    )

    return new_category


@router.delete("/{category_id}", response_model=CategoryResponse)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    linked = db.query(Stock).filter(Stock.category_id == category_id).count()
    if linked > 0:
        raise HTTPException(
            status_code=400,
            detail=f"삭제 불가: '{category.name}' 카테고리를 사용하는 상품이 {linked}개 존재합니다.",
        )

    log_crud.create_log(
        db,
        LogCreate(
            robot_name="-",
            robot_ip=None,
            pin_name="-",
            pin_coords=None,
            category_name=category.name,
            stock_name="-",
            stock_id=None,
            quantity=0,
            action="카테고리 삭제",
            timestamp=datetime.now(timezone(timedelta(hours=9))),
        ),
    )

    db.delete(category)
    db.commit()

    remaining = db.execute(text("SELECT COUNT(*) FROM category")).scalar()
    if remaining == 0:
        db.execute(text("ALTER TABLE category AUTO_INCREMENT = 1"))
        db.commit()

    return category