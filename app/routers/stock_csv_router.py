from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.stock_csv_service import StockCsvService

# CSV 업로드 전용 라우터
router = APIRouter()


# 재고 CSV 업로드 처리
@router.post("/csv/upload")
async def upload_stock_csv(file: UploadFile = File(...)):
    # CSV 파일 확장자 검사
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드할 수 있습니다.")

    # 업로드된 파일 내용 읽기
    content = await file.read()

    # CSV 처리 서비스 호출
    try:
        result = StockCsvService.process_csv(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV 처리 중 오류 발생: {str(e)}")

    return {
        "message": "CSV 업로드 완료",
        "processed_rows": result,
    }


# 재고 CSV 템플릿 다운로드
@router.get("/csv/template")
def download_stock_csv_template():
    from fastapi.responses import StreamingResponse
    from io import StringIO

    # CSV 헤더 정의
    headers = [
        "id",
        "name",
        "quantity",
        "category_id",
        "pin_id",
    ]

    # CSV 템플릿 생성
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