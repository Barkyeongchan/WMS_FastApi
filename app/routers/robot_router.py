# app/routers/robot_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.models.robot_model import Robot
from app.schemas.robot_schema import RobotResponse, RobotCreate, RobotUpdate
from app.core.ros.ros_manager import ros_manager

router = APIRouter(prefix="/robots", tags=["Robots"])

# DB 세션
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------------------------
# ✅ 로봇 등록
# -------------------------------------------
@router.post("/", response_model=RobotResponse)
def create_robot(robot: RobotCreate, db: Session = Depends(get_db)):
    try:
        db_robot = Robot(**robot.dict())
        db.add(db_robot)
        db.commit()
        db.refresh(db_robot)
        print(f"[API] 로봇 등록 완료 → {db_robot.name} ({db_robot.ip})")
        return db_robot
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"등록 실패: {e}")

# -------------------------------------------
# ✅ 목록 조회
# -------------------------------------------
@router.get("/", response_model=List[RobotResponse])
def read_robots(db: Session = Depends(get_db)):
    return db.query(Robot).all()

# -------------------------------------------
# ✅ 단일 조회
# -------------------------------------------
@router.get("/{robot_id}", response_model=RobotResponse)
def read_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    return robot

# -------------------------------------------
# ✅ 로봇 연결
# -------------------------------------------
@router.post("/connect/{robot_id}")
async def connect_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    try:
        ros_manager.connect_robot(robot.name, robot.ip)
        print(f"[API] 로봇 연결 요청 완료 → {robot.name} ({robot.ip})")
        return {"message": f"로봇 '{robot.name}' 연결 완료", "ip": robot.ip, "connected": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect robot: {e}")

# -------------------------------------------
# ✅ 로봇 연결 해제
# -------------------------------------------
@router.post("/disconnect/{robot_id}")
async def disconnect_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    try:
        ros_manager.disconnect_robot(robot.name)
        print(f"[API] 로봇 연결 해제 완료 → {robot.name}")
        return {"message": f"로봇 '{robot.name}' 연결 해제", "connected": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect robot: {e}")

# -------------------------------------------
# ✅ [추가] 로봇 연결 상태 조회
# -------------------------------------------
@router.get("/status/{robot_id}")
def get_robot_status(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    status = ros_manager.get_status(robot.name)
    return {"robot": robot.name, "ip": status["ip"], "connected": status["connected"]}

# -------------------------------------------
# ✅ 수정 / 삭제
# -------------------------------------------
@router.put("/{robot_id}", response_model=RobotResponse)
def update_robot(robot_id: int, update_data: RobotUpdate, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    for k, v in update_data.dict(exclude_unset=True).items():
        setattr(robot, k, v)
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