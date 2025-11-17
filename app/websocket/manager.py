# app/websocket/manager.py
import asyncio
from fastapi import WebSocket

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.pin_model import Pin

_active_clients = []
robot_status_cache = {}

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

    # 🔥 캐싱된 로봇 상태 전송
    try:
        for robot_name, status in robot_status_cache.items():
            await ws.send_json({
                "type": "robot_status",
                "payload": {
                    "name": robot_name,
                    "state": status.get("state", "대기중")
                }
            })
            print(f"[WS] 상태 복구 전송 → {robot_name}: {status.get('state')}")
    except Exception as e:
        print("[WS] 상태 복구 오류:", e)


    # 🔥 활성 로봇 상태 전송
    try:
        from app.core.ros.ros_manager import ros_manager
        active = ros_manager.active_robot

        if active:
            client = ros_manager.clients.get(active)
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

    # 🔥 마지막 로봇 좌표 복구 전송
    try:
        from app.core.ros.ros_manager import ros_manager
        last_pose = ros_manager.last_pose   # ← 정답

        if last_pose:
            await ws.send_json({
                "type": "robot_pose_restore",
                "payload": last_pose
            })
            print("[WS] 마지막 로봇 위치 전송 완료")

    except Exception as e:
        print("[WS] last_pose 전송 오류:", e)



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
            from app.core.ros.ros_manager import ros_manager
            ros_manager.send_cmd_vel(data.get("payload") or {})
        except Exception as e:
            print("[WS] cmd_vel 오류:", e)
        return

    # --------------------------------------------------
    #  재고 이동 요청 (대시보드)
    # --------------------------------------------------
    if msg_type == "request_stock_move":
        try:
            from app.core.ros.ros_manager import ros_manager

            payload = data.get("payload") or {}
            stock_id = payload.get("stock_id")
            amount   = payload.get("amount")
            mode     = payload.get("mode")

            print(f"[WS] 📦 이동 요청 → stock_id={stock_id}, mode={mode}")

            # 이동중 상태 전송
            ws_manager.broadcast({
                "type": "robot_status",
                "payload": {"state": "이동중"}
            })

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
                command = f"{pin.name}"

                ros_manager.send_ui_command(command)
                print(f"[WS] → ROS UI 명령 전송: {command}")

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
    #  완료 확인(APP)
    # --------------------------------------------------
    if msg_type == "complete_stock_move":
        try:
            from app.core.ros.ros_manager import ros_manager

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

                if stock:
                    if mode == "INBOUND":
                        stock.quantity += amount
                    else:
                        stock.quantity = max(stock.quantity - amount, 0)

                    db.commit()
                    print("[WS] ✅ 수량 업데이트 완료")

                    ws_manager.broadcast({
                        "type": "stock_update",
                        "payload": {}
                    })

            finally:
                db.close()

            ros_manager.send_ui_command("WAIT")
            print("[WS] 🚚 WAIT → 복귀 시작")

            ws_manager.broadcast({
                "type": "robot_status",
                "payload": {"state": "복귀중"}
            })

        except Exception as e:
            
            print("[WS] complete_stock_move 처리 오류:", e)

        return

    # --------------------------------------------------
    #  상태 갱신 요청
    # --------------------------------------------------
    if msg_type == "robot_status":
        payload = data.get("payload") or {}
        name = payload.get("name")
    
        # ⭐ name 없으면 active_robot 자동 삽입
        if not name:
            from app.core.ros.ros_manager import ros_manager
            name = ros_manager.active_robot
            payload["name"] = name
    
        # ⭐ 캐시에 저장
        if name:
            robot_status_cache[name] = {
                "state": payload.get("state", "대기중")
            }
            print(f"[CACHE] 로봇 상태 저장: {name} → {payload.get('state')}")
    
        # ⭐ 모든 클라이언트에게 브로드캐스트
        ws_manager.broadcast({
            "type": "robot_status",
            "payload": payload
        })
        return

    # --------------------------------------------------
    #  UI 명령
    # --------------------------------------------------
    if msg_type == "ui_command":
        cmd = data.get("payload", {}).get("command")
        print(f"[WS] UI 명령 수신: {cmd}")

        from app.core.ros.ros_manager import ros_manager
        ros_manager.send_ui_command(cmd)
        return