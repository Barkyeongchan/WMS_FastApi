from sqlalchemy.orm import Session
from app.crud import robot_crud
from app.models.robot import Robot

class RobotService:

    def __init__(self, db: Session):
        self.db = db

    # CREATE 로봇 추가
    def create_robot(self, name: str, ip: str, status: str):
        robot = Robot(name=name, ip=ip, status=status)
        return robot_crud.create_robot(self.db, robot)

    # READ 로봇 목록 조회
    def list_robots(self, skip: int = 0, limit: int = 100):
        return robot_crud.get_robots(self.db, skip, limit)