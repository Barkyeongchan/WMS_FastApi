# app/websocket/manager.py
import asyncio
from fastapi import WebSocket

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.pin_model import Pin

_active_clients = []


# ===========================
#  클라이언트 등록
# ===========================
async def register(ws: WebSocket):
    _active_clients.append(ws)
    print(f"[WS] 클라이언트 연결됨 (total={len(_active_clients)})")

    # 🔥 활성 로봇 상태 자동 송신
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
                        "connected": True,
                    },
                })
                print(f"[WS] 활성 로봇 상태 재전송 → {active}")
    except Exception as e:
        print("[WS] 활성 상태 전송 실패:", e)


# ===========================
#  해제
# ===========================
async def unregister(ws: WebSocket):
    if ws in _active_clients:
        _active_clients.remove(ws)
    print(f"[WS] 클라이언트 해제됨 (total={len(_active_clients)})")


# ===========================
#  Broadcast
# ===========================
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
            asyncio.run_coroutine_threadsafe(broadcast_json(data), self.loop)
        except RuntimeError:
            loop = asyncio.get_event_loop()
            asyncio.run_coroutine_threadsafe(broadcast_json(data), loop)


ws_manager = WSManager()


# ===========================
#  Web ↔ Server 메시지 처리 (핵심)
# ===========================
async def handle_message(ws: WebSocket, data: dict):

    msg_type = data.get("type")
    if not msg_type:
        return

    # ping / init
    if msg_type in ["ping", "init_request"]:
        return

    # =================================
    #  cmd_vel → ROS
    # =================================
    if msg_type == "cmd_vel":
        try:
            from app.core.ros import ros_manager
            payload = data.get("payload") or {}
            ros_manager.ros_manager.send_cmd_vel(payload)
        except Exception as e:
            print("[WS] cmd_vel 처리 오류:", e)
        return

    # =================================
    #  입고 / 출고 요청
    # =================================
    if msg_type == "request_stock_move":
        try:
            from app.core.ros import ros_manager

            payload = data.get("payload") or {}
            stock_id = payload.get("stock_id")
            amount   = payload.get("amount")
            mode     = payload.get("mode")   # INBOUND / OUTBOUND

            print(f"[WS] 📦 재고 이동 요청 → stock_id={stock_id}, mode={mode}")

            db = SessionLocal()
            try:
                stock = db.query(Stock).filter(Stock.id == stock_id).first()
                if not stock:
                    print("[WS] ❌ stock_id 없음")
                    return

                pin = db.query(Pin).filter(Pin.id == stock.pin_id).first()
                if not pin or not pin.coords:
                    print("[WS] ❌ pin 좌표 없음")
                    return

                x, y = [c.strip() for c in pin.coords.split(",")]

                command = f"{mode}:{stock.name}:{x}:{y}:{amount}"

                # 🔥 로봇으로 퍼블리시
                ros_manager.ros_manager.send_ui_command(command)

                print(f"[WS] → ROS UI 명령 전송: {command}")

            finally:
                db.close()

        except Exception as e:
            print("[WS] request_stock_move 오류:", e)

        return