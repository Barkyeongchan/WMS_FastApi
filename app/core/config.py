from pydantic import BaseSettings

class Settings(BaseSettings):
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    SERVER_PORT: int
    DEBUG: bool = True

    class Config:
        env_file = ".env"

settings = Settings()