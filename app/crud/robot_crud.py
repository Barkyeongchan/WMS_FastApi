from sqlalchemy.orm import Session
from app.models.robot_model import Robot
from app.schemas.robot_schema import RobotCreate, RobotUpdate

# READ-ALL 전체 로봇 조회
def get_robots(db: Session):
    return db.query(Robot).all()

# READ 단일 로봇 조회 (ID 기준)
def get_robot_by_id(db: Session, robot_id: int):
    return db.query(Robot).filter(Robot.id == robot_id).first()

# CREATE 새로운 로봇 추가
def create_robot(db: Session, robot: RobotCreate):
    db_robot = Robot(**robot.dict())
    db.add(db_robot)
    db.commit()
    db.refresh(db_robot)
    return db_robot

# UPDATE 로봇 데이터 수정
def update_robot(db: Session, robot_id: int, update_data: RobotUpdate):
    db_robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not db_robot:
        return None

    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(db_robot, key, value)

    db.commit()
    db.refresh(db_robot)
    return db_robot

# DELETE 로봇 삭제
def delete_robot(db: Session, robot_id: int):
    db_robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not db_robot:
        return None

    db.delete(db_robot)
    db.commit()
    return db_robot