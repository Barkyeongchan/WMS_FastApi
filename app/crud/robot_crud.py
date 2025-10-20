from sqlalchemy.orm import Session
from app.models.robot_model import Robot

# CREATE 새로운 로봇 데이터 추가
def create_robot(db: Session, robot_data: dict):
    robot = Robot(**robot_data)   # 전달받은 dict → Robot 객체 변환
    db.add(robot)                 # 세션에 추가
    db.commit()                   # 변경사항 저장
    db.refresh(robot)             # 최신 상태로 갱신
    return robot


# READ 특정 로봇 ID로 조회
def get_robot(db: Session, robot_id: int):
    return db.query(Robot).filter(Robot.id == robot_id).first()


# READ-ALL 전체 로봇 또는 일부 목록 조회
def get_robots(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Robot).offset(skip).limit(limit).all()


# UPDATE 로봇 데이터 수정
def update_robot(db: Session, robot_id: int, update_data: dict):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        return None

    for key, value in update_data.items():
        setattr(robot, key, value)

    db.commit()
    db.refresh(robot)
    return robot


# DELETE 로봇 데이터 삭제
def delete_robot(db: Session, robot_id: int):
    robot = db.query(Robot).filter(Robot.id == robot_id).first()
    if not robot:
        return None

    db.delete(robot)
    db.commit()
    return robot