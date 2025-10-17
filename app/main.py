from fastapi import FastAPI
from app.core.config import settings

app = FastAPI(title="WMS FastAPI Server", debug=settings.DEBUG)

@app.get("/")
def root():
    return {"message": "FastAPI 서버 실행"}