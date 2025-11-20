import asyncio
from fastapi import WebSocket
from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.pin_model import Pin
from app.schemas.log_schema import LogCreate
from app.crud import log_crud

_active_clients = []
robot_status_cache = {}

_last_job = {
    "stock_id": None,
    "amount": None,
    "mode": None,
}

def now():
    return datetime.now(timezone(timedelta(hours=9)))

# ======================================================================
#  WebSocket 등록
# ======================================================================
async def register(ws: WebSocket):
    _active_clients.append(ws)
    print(f"[WS] 클라이언트 연결됨 (total={len(_active_clients)})")

    # 캐시 상태복구
    for robot_name, status in robot_status_cache.items():
        try:
            await ws.send_json({
                "type": "robot_status",
                "payload": {
                    "name": robot_name,
                    "state": status.get("state", "대기중")
                }
            })
        except:
            pass

    # 활성 로봇 복구
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
    except:
        pass

    # 마지막 위치 복구
    try:
        from app.core.ros.ros_manager import ros_manager
        last_pose = ros_manager.last_pose
        if last_pose:
            await ws.send_json({
                "type": "robot_pose_restore",
                "payload": last_pose
            })
    except:
        pass


# ======================================================================
#  WebSocket 해제
# ======================================================================
async def unregister(ws: WebSocket):
    if ws in _active_clients:
        _active_clients.remove(ws)


# ======================================================================
#  Broadcast
# ======================================================================
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


# ======================================================================
#  메시지 처리
# ======================================================================
async def handle_message(ws: WebSocket, data: dict):
    global _last_job

    msg_type = data.get("type")
    if not msg_type:
        return

    # -------------------------------------------------------------
    # cmd_vel
    # -------------------------------------------------------------
    if msg_type == "cmd_vel":
        from app.core.ros.ros_manager import ros_manager
        ros_manager.send_cmd_vel(data.get("payload") or {})
        return

    # -------------------------------------------------------------
    # 재고 이동 요청 (입고/출고 시작)
    # -------------------------------------------------------------
    if msg_type == "request_stock_move":
        try:
            from app.core.ros.ros_manager import ros_manager

            payload = data.get("payload") or {}
            stock_id = payload.get("stock_id")
            amount   = int(payload.get("amount"))
            mode     = payload.get("mode")

            print(f"[WS] 이동 요청 → stock_id={stock_id}, mode={mode}")

            ws_manager.broadcast({
                "type": "robot_status",
                "payload": {"state": "이동중"}
            })

            db = SessionLocal()
            stock = db.query(Stock).filter(Stock.id == stock_id).first()
            pin   = db.query(Pin).filter(Pin.id == stock.pin_id).first()

            _last_job = {
                "stock_id": stock_id,
                "amount": amount,
                "mode": mode
            }

            # 명령 전송
            ros_manager.send_ui_command(pin.name)

            # 로그 등록: 입고 시작 / 출고 시작
            action = "입고 시작" if mode == "INBOUND" else "출고 시작"

            log_crud.create_log(db, LogCreate(
                robot_name=ros_manager.active_robot,
                pin_name=pin.name,
                category_name=stock.category.name,
                stock_name=stock.name,
                stock_id=stock_id,
                quantity=amount,
                action=action,
                timestamp=now()
            ))

            db.close()

        except Exception as e:
            print("[WS] 재고 이동 요청 오류:", e)

        return

    # -------------------------------------------------------------
    # 완료 확인 (입고 완료 → 0.3초 → 복귀 시작)
    # -------------------------------------------------------------
    if msg_type == "complete_stock_move":
        try:
            from app.core.ros.ros_manager import ros_manager

            job = _last_job
            stock_id = job["stock_id"]
            amount   = job["amount"]
            mode     = job["mode"]

            db = SessionLocal()
            stock = db.query(Stock).filter(Stock.id == stock_id).first()
            pin = stock.pin

            old_qty = stock.quantity
            if mode == "INBOUND":
                stock.quantity += amount
            else:
                stock.quantity = max(stock.quantity - amount, 0)

            new_qty = stock.quantity
            db.commit()

            # 1) 입고 완료 / 출고 완료 로그 (순서 보장)
            action = f"{'입고' if mode=='INBOUND' else '출고'} 완료 ({old_qty} → {new_qty})"

            log_crud.create_log(db, LogCreate(
                robot_name=ros_manager.active_robot,
                pin_name=pin.name,
                category_name=stock.category.name,
                stock_name=stock.name,
                stock_id=stock_id,
                quantity=amount,
                action=action,
                timestamp=now()
            ))

            db.close()

            # -------------------------------------------
            # 2) 0.3초 후 복귀 시작 처리 (순서 보장 핵심)
            # -------------------------------------------
            async def delayed_return():
                await asyncio.sleep(0.3)

                ros_manager.send_ui_command("WAIT")

                ws_manager.broadcast({
                    "type": "robot_status",
                    "payload": {"state": "복귀중"}
                })

                db2 = SessionLocal()
                log_crud.create_log(db2, LogCreate(
                    robot_name=ros_manager.active_robot,
                    pin_name="-",
                    category_name="-",
                    stock_name="-",
                    stock_id=None,
                    quantity=0,
                    action="복귀 시작",
                    timestamp=now()
                ))
                db2.close()

            asyncio.create_task(delayed_return())

        except Exception as e:
            print("[WS] complete_stock_move 오류:", e)

        return

    # -------------------------------------------------------------
    # 도착 / 복귀 완료
    # -------------------------------------------------------------
    if msg_type == "robot_status":
        payload = data.get("payload") or {}
        state = payload.get("state")

        from app.core.ros.ros_manager import ros_manager

        name = payload.get("name") or ros_manager.active_robot
        payload["name"] = name

        robot_status_cache[name] = {"state": state}

        # ⭐ 도착 로그
        if state == "도착":
            db = SessionLocal()
            stock = db.query(Stock).filter(Stock.id == _last_job["stock_id"]).first()
            pin = stock.pin

            log_crud.create_log(db, LogCreate(
                robot_name=name,
                pin_name=pin.name,
                category_name="-",
                stock_name="-",
                stock_id=None,
                quantity=0,
                action="도착",
                timestamp=now()
            ))
            db.close()

        # ⭐ WAIT → 대기중 → 복귀 완료
        if state == "대기중":
            db = SessionLocal()
            log_crud.create_log(db, LogCreate(
                robot_name=name,
                pin_name="-",
                category_name="-",
                stock_name="-",
                stock_id=None,
                quantity=0,
                action="복귀 완료",
                timestamp=now()
            ))
            db.close()

        ws_manager.broadcast({
            "type": "robot_status",
            "payload": payload
        })
        return

    # -------------------------------------------------------------
    # UI 명령
    # -------------------------------------------------------------
    if msg_type == "ui_command":
        from app.core.ros.ros_manager import ros_manager
        cmd = data.get("payload", {}).get("command")
        ros_manager.send_ui_command(cmd)
        return