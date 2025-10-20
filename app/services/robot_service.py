from sqlalchemy.orm import Session
from app.crud import robot_crud
from app.models.robot_model import Robot

class RobotService:
    def __init__(self, db: Session):
        self.db = db

    # CREATE 로봇 등록
    def create_robot(self, name: str, ip: str):
        robot = Robot(name=name, ip=ip)
        return robot_crud.create_robot(self.db, robot)

    # READ 전체 로봇 조회
    def list_robots(self, skip: int = 0, limit: int = 100):
        return robot_crud.get_robots(self.db, skip, limit)