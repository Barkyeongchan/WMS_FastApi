from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import SessionLocal
from app.models.robot_model import Robot
from app.schemas.robot_schema import RobotResponse, RobotCreate, RobotUpdate
from app.core.ros.ros_manager import ros_manager

# 로봇 관련 API 라우터
router = APIRouter(prefix="/robots", tags=["Robots"])


# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 로봇 등록
@router.post("/", response_model=RobotResponse)
def create_robot(robot: RobotCreate, db: Session = Depends(get_db)):
    try:
        # 로봇 DB 등록
        db_robot = Robot(**robot.dict())
        db.add(db_robot)
        db.commit()
        db.refresh(db_robot)

        print(f"[API] 로봇 등록 완료 → {db_robot.name} ({db_robot.ip})")
        return db_robot
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"등록 실패: {e}")


# 로봇 목록 조회
@router.get("/", response_model=List[RobotResponse])
def read_robots(db: Session = Depends(get_db)):
    return db.query(Robot).all()


# 로봇 단일 조회
@router.get("/{robot_id}", response_model=RobotResponse)
def read_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    return robot


# 로봇 ROS 연결
@router.post("/connect/{robot_id}")
async def connect_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    try:
        # ROS 매니저에 로봇 연결 요청
        ros_manager.connect_robot(robot.name, robot.ip)
        print(f"[API] 로봇 연결 요청 완료 → {robot.name} ({robot.ip})")

        return {
            "message": f"로봇 '{robot.name}' 연결 완료",
            "ip": robot.ip,
            "connected": True,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect robot: {e}")


# 로봇 ROS 연결 해제
@router.post("/disconnect/{robot_id}")
async def disconnect_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    try:
        # ROS 매니저에서 로봇 연결 해제
        ros_manager.disconnect_robot(robot.name)
        print(f"[API] 로봇 연결 해제 완료 → {robot.name}")

        return {
            "message": f"로봇 '{robot.name}' 연결 해제",
            "connected": False,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect robot: {e}")


# 로봇 연결 상태 조회
@router.get("/status/{robot_id}")
def get_robot_status(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    # ROS 매니저에서 현재 상태 조회
    status = ros_manager.get_status(robot.name)
    return {
        "robot": robot.name,
        "ip": status["ip"],
        "connected": status["connected"],
    }


# 로봇 정보 수정
@router.put("/{robot_id}", response_model=RobotResponse)
def update_robot(robot_id: int, update_data: RobotUpdate, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    # 변경된 필드만 업데이트
    for k, v in update_data.dict(exclude_unset=True).items():
        setattr(robot, k, v)

    db.commit()
    db.refresh(robot)
    return robot


# 로봇 삭제
@router.delete("/{robot_id}", response_model=RobotResponse)
def delete_robot(robot_id: int, db: Session = Depends(get_db)):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")

    db.delete(robot)
    db.commit()
    return robot