from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import SessionLocal
from app.models.robot_model import Robot
from app.schemas.robot_schema import RobotResponse, RobotCreate, RobotUpdate

# 🔥 추가: WebSocket 브로드캐스트
from app.websocket.manager import broadcast_json

router = APIRouter(prefix="/robots", tags=["Robots"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=List[RobotResponse])
def read_robots(db: Session = Depends(get_db)):
    return db.query(Robot).all()

@router.get("/{robot_id}", response_model=RobotResponse)
def read_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    return robot

@router.post("/", response_model=RobotResponse)
def create_robot(robot: RobotCreate, db: Session = Depends(get_db)):
    db_robot = Robot(**robot.dict())
    db.add(db_robot)
    db.commit()
    db.refresh(db_robot)
    return db_robot

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

@router.delete("/{robot_id}", response_model=RobotResponse)
def delete_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    db.delete(robot)
    db.commit()
    return robot

# ✅ 여기만 핵심
@router.post("/connect/{robot_id}")
async def connect_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    msg = {
        "type": "connect_robot",
        "payload": {
            "name": robot.name,
            "ip": robot.ip
        }
    }

    # 🔥 로컬 브릿지(WASDController)에게 WebSocket으로 전송
    await broadcast_json(msg)

    print(f"[EC2] 로봇 연결 요청 전송 → {robot.name} ({robot.ip})")
    return {"message": f"로봇 '{robot.name}' 연결 요청 전송 완료", "ip": robot.ip}