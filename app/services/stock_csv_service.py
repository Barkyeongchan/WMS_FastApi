import csv
from io import StringIO
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.crud import log_crud
from app.schemas.log_schema import LogCreate
from app.websocket.manager import ws_manager


# CSV 업로드 처리 서비스
class StockCsvService:

    # CSV 바이트를 문자열로 디코딩
    @staticmethod
    def _decode(content: bytes) -> str:
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            return content.decode("cp949")

    # CSV를 처리하고 처리된 행 수 반환
    @staticmethod
    def process_csv(content: bytes) -> int:
        # CSV 디코딩 및 DictReader 생성
        decoded = StockCsvService._decode(content)
        reader = csv.DictReader(StringIO(decoded))

        # 헤더 유효성 확인
        if not reader.fieldnames:
            raise Exception("CSV 헤더를 읽을 수 없습니다.")

        # 헤더 공백 제거
        reader.fieldnames = [h.strip() for h in reader.fieldnames]

        # 필수 컬럼 확인
        required = ["name", "quantity", "category_id"]
        for h in required:
            if h not in reader.fieldnames:
                raise Exception(f"CSV에 '{h}' 컬럼이 없습니다.")

        # DB 세션 생성
        db: Session = SessionLocal()
        count = 0

        try:
            for row in reader:
                # 빈 행 스킵
                if not any((v or "").strip() for v in row.values()):
                    continue

                # 상품명 파싱
                name = (row.get("name") or "").strip()
                if not name:
                    continue

                # 수량/카테고리/핀 파싱
                qty = int((row.get("quantity") or "0").strip())
                cat_id = int((row.get("category_id") or "0").strip())
                pin_id_raw = (row.get("pin_id") or "").strip()
                pin_id = int(pin_id_raw) if pin_id_raw else None

                # ID 기반 업데이트 여부 판단
                id_raw = (row.get("id") or "").strip()
                stock_obj = None

                if id_raw:
                    try:
                        stock_obj = db.query(Stock).filter(Stock.id == int(id_raw)).first()
                    except:
                        stock_obj = None

                # 기존 상품 업데이트
                if stock_obj:
                    old_name = stock_obj.name
                    old_qty = stock_obj.quantity
                    old_cat = stock_obj.category_id
                    old_pin = stock_obj.pin_id

                    # 변경 사항 수집
                    changed = []
                    if old_name != name:
                        changed.append(f"이름 '{old_name}'→'{name}'")
                    if old_qty != qty:
                        changed.append(f"수량 {old_qty}→{qty}")
                    if old_cat != cat_id:
                        changed.append(f"카테고리 {old_cat}→{cat_id}")
                    if old_pin != pin_id:
                        changed.append(f"위치 {old_pin}→{pin_id}")

                    # DB 업데이트 적용
                    stock_obj.name = name
                    stock_obj.quantity = qty
                    stock_obj.category_id = cat_id
                    stock_obj.pin_id = pin_id

                    # 변경된 항목이 있을 때만 로그 기록
                    if changed:
                        log_crud.create_log(
                            db,
                            LogCreate(
                                robot_name="-",
                                robot_ip=None,
                                pin_name=stock_obj.pin.name if stock_obj.pin else "-",
                                pin_coords=None,
                                category_name=stock_obj.category.name if stock_obj.category else "-",
                                stock_name=name,
                                stock_id=stock_obj.id,
                                quantity=qty,
                                action="CSV 수정 (" + ", ".join(changed) + ")",
                                timestamp=datetime.now(timezone(timedelta(hours=9))),
                            ),
                        )

                # 신규 상품 등록
                else:
                    new_obj = Stock(
                        name=name,
                        quantity=qty,
                        category_id=cat_id,
                        pin_id=pin_id,
                    )
                    db.add(new_obj)

                    # 신규 ID 확보
                    db.flush()

                    log_crud.create_log(
                        db,
                        LogCreate(
                            robot_name="-",
                            robot_ip=None,
                            pin_name=new_obj.pin.name if new_obj.pin else "-",
                            pin_coords=None,
                            category_name=new_obj.category.name if new_obj.category else "-",
                            stock_name=name,
                            stock_id=new_obj.id,
                            quantity=qty,
                            action="CSV 등록",
                            timestamp=datetime.now(timezone(timedelta(hours=9))),
                        ),
                    )

                count += 1

            # 트랜잭션 커밋
            db.commit()

        except Exception:
            # 오류 발생 시 롤백
            db.rollback()
            raise

        finally:
            # DB 세션 종료
            db.close()

        # 재고 리스트 갱신 브로드캐스트
        ws_manager.broadcast({"type": "stock_update", "payload": {}})

        return count