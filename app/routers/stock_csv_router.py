# app/routers/stock_csv_router.py
# 목적: CSV 업로드 전용 라우터 (기존 기능 절대 수정하지 않음)

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.stock_csv_service import StockCsvService

router = APIRouter()

@router.post("/csv/upload")
async def upload_stock_csv(file: UploadFile = File(...)):
    # csv 파일 확장자 확인
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드할 수 있습니다.")

    # 파일 내용 읽기
    content = await file.read()

    # 서비스 호출
    try:
        result = StockCsvService.process_csv(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV 처리 중 오류 발생: {str(e)}")

    return {"message": "CSV 업로드 완료", "processed_rows": result}

@router.get("/csv/template", summary="CSV 템플릿 다운로드")
def download_stock_csv_template():
    from fastapi.responses import StreamingResponse
    from io import StringIO

    headers = [
        "id",
        "name",
        "quantity",
        "category_id",
        "pin_id",
    ]

    buffer = StringIO()
    buffer.write(",".join(headers) + "\n")
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="stock_template.csv"'
        },
    )
