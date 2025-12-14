from pydantic import BaseSettings

class Settings(BaseSettings):
    # DB 계정
    DB_USER: str
    DB_PASSWORD: str

    # DB 접속 정보
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    # 서버 설정
    SERVER_PORT: int
    DEBUG: bool = True

    class Config:
        # 환경변수 파일
        env_file = ".env"

# 전역 설정 인스턴스
settings = Settings()