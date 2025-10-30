# app/routers/robot_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.models.robot_model import Robot
from app.schemas.robot_schema import RobotResponse, RobotCreate, RobotUpdate

router = APIRouter(prefix="/robots", tags=["Robots"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# READ-ALL 전체 로봇 조회
@router.get("/", response_model=List[RobotResponse])
def read_robots(db: Session = Depends(get_db)):
    return db.query(Robot).all()

# READ 단일 로봇 조회
@router.get("/{robot_id}", response_model=RobotResponse)
def read_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    return robot

# CREATE 로봇 생성
@router.post("/", response_model=RobotResponse)
def create_robot(robot: RobotCreate, db: Session = Depends(get_db)):
    db_robot = Robot(**robot.dict())
    db.add(db_robot)
    db.commit()
    db.refresh(db_robot)
    return db_robot

# UPDATE 로봇 수정
@router.put("/{robot_id}", response_model=RobotResponse)
def update_robot(robot_id: int, update_data: RobotUpdate, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(robot, key, value)
    db.commit()
    db.refresh(robot)
    return robot

# DELETE 로봇 삭제
@router.delete("/{robot_id}", response_model=RobotResponse)
def delete_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    db.delete(robot)
    db.commit()
    return robot