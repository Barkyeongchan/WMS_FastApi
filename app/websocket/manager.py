# app/websocket/manager.py
import asyncio
from fastapi import WebSocket

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.pin_model import Pin

_active_clients = []

# 🔥 마지막 작업 정보 저장
_last_job = {
    "stock_id": None,
    "amount": None,
    "mode": None,
}


# ======================================================
#  클라이언트 등록
# ======================================================
async def register(ws: WebSocket):
    _active_clients.append(ws)
    print(f"[WS] 클라이언트 연결됨 (total={len(_active_clients)})")

    # 기존 활성 로봇 상태 전송
    try:
        from app.core.ros import ros_manager
        active = ros_manager.ros_manager.active_robot

        if active:
            client = ros_manager.ros_manager.clients.get(active)
            if client and client.connected:
                await ws.send_json({
                    "type": "status",
                    "payload": {
                        "robot_name": active,
                        "ip": client.ip,
                        "connected": True
                    }
                })
                print(f"[WS] 활성 로봇 상태 재전송 → {active}")

    except Exception as e:
        print("[WS] 상태 재전송 오류:", e)


# ======================================================
#  클라이언트 해제
# ======================================================
async def unregister(ws: WebSocket):
    if ws in _active_clients:
        _active_clients.remove(ws)
    print(f"[WS] 클라이언트 해제됨 (total={len(_active_clients)})")


# ======================================================
#  브로드캐스트
# ======================================================
async def broadcast_json(data: dict):
    for ws in list(_active_clients):
        try:
            await ws.send_json(data)
        except:
            await unregister(ws)


class WSManager:
    def __init__(self):
        self.loop = asyncio.get_event_loop()

    def broadcast(self, data: dict):
        try:
            asyncio.run_coroutine_threadsafe(
                broadcast_json(data), self.loop
            )
        except RuntimeError:
            loop = asyncio.get_event_loop()
            asyncio.run_coroutine_threadsafe(
                broadcast_json(data), loop
            )


ws_manager = WSManager()


# ======================================================
#  메시지 처리
# ======================================================
async def handle_message(ws: WebSocket, data: dict):
    global _last_job

    msg_type = data.get("type")
    if not msg_type:
        return

    # ping / init
    if msg_type in ["ping", "init_request"]:
        return

    # --------------------------------------------------
    #  cmd_vel → ROS 전송
    # --------------------------------------------------
    if msg_type == "cmd_vel":
        try:
            from app.core.ros import ros_manager
            ros_manager.ros_manager.send_cmd_vel(data.get("payload") or {})
        except Exception as e:
            print("[WS] cmd_vel 오류:", e)
        return

    # --------------------------------------------------
    #  재고 이동 요청 (대시보드)
    # --------------------------------------------------
    if msg_type == "request_stock_move":
        try:
            from app.core.ros import ros_manager

            payload = data.get("payload") or {}
            stock_id = payload.get("stock_id")
            amount   = payload.get("amount")
            mode     = payload.get("mode")

            print(f"[WS] 📦 이동 요청 → stock_id={stock_id}, mode={mode}")

            # 이동중 상태 전송 (APP용)
            ws_manager.broadcast({
                "type": "robot_status",
                "payload": {"state": "이동중"}
            })

            # 숫자 변환
            try:
                amount = int(amount)
            except:
                print("[WS] ❌ amount 변환 실패")
                return

            db = SessionLocal()
            try:
                stock = db.query(Stock).filter(Stock.id == stock_id).first()
                pin   = db.query(Pin).filter(Pin.id == stock.pin_id).first()

                if not stock or not pin or not pin.coords:
                    print("[WS] ❌ stock/pin 없음")
                    return

                x, y = [c.strip() for c in pin.coords.split(",")]
                command = f"{mode}:{stock.name}:{x}:{y}:{amount}"

                # ROS publish
                ros_manager.ros_manager.send_ui_command(command)
                print(f"[WS] → ROS UI 명령 전송: {command}")

                # 마지막 작업 정보 저장
                _last_job = {
                    "stock_id": stock_id,
                    "amount": amount,
                    "mode": mode
                }

            finally:
                db.close()

        except Exception as e:
            print("[WS] 재고 이동 요청 오류:", e)

        return

    # --------------------------------------------------
    #  완료 확인(APP) → DB 반영 + WAIT
    # --------------------------------------------------
    if msg_type == "complete_stock_move":
        try:
            from app.core.ros import ros_manager

            job = _last_job or {}
            stock_id = job.get("stock_id")
            amount   = job.get("amount")
            mode     = job.get("mode")

            print(f"[WS] ✔ 완료 확인 → {job}")

            if not stock_id or not amount or not mode:
                print("[WS] ❌ job 없음")
                return

            db = SessionLocal()
            try:
                stock = db.query(Stock).filter(Stock.id == stock_id).first()

                if not stock:
                    print("[WS] ❌ 재고 없음")
                else:
                    # DB 업데이트
                    if mode == "INBOUND":
                        new_qty = stock.quantity + amount
                    else:  # OUTBOUND
                        new_qty = max(stock.quantity - amount, 0)

                    stock.quantity = new_qty
                    db.commit()

                    print(f"[WS] ✅ DB 수량 업데이트 → {new_qty}")

                    # ⭐⭐⭐ 대시보드 재고 갱신
                    ws_manager.broadcast({
                        "type": "stock_update",
                        "payload": {}
                    })

            finally:
                db.close()

            # 로봇 복귀
            ros_manager.ros_manager.send_ui_command("WAIT")
            print("[WS] 🚚 WAIT → 복귀 시작")

            # 복귀중 상태 전송
            ws_manager.broadcast({
                "type": "robot_status",
                "payload": {"state": "복귀중"}
            })

        except Exception as e:
            print("[WS] complete_stock_move 처리 오류:", e)

        return