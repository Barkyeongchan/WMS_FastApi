import asyncio
from fastapi import WebSocket
from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.stock_model import Stock
from app.models.pin_model import Pin
from app.schemas.log_schema import LogCreate
from app.crud import log_crud

# WebSocket 활성 클라이언트 목록
_active_clients = []

# 로봇 상태 캐시 (새 클라이언트 접속 시 상태 복구용)
robot_status_cache = {}

# 마지막 작업(입고/출고) 정보 캐시
_last_job = {
    "stock_id": None,
    "amount": None,
    "mode": None,
}

# KST 현재 시간
def now():
    return datetime.now(timezone(timedelta(hours=9)))


# WebSocket 클라이언트 등록 + 캐시 복구 전송
async def register(ws: WebSocket):
    _active_clients.append(ws)
    print(f"[WS] 클라이언트 연결됨 (total={len(_active_clients)})")

    # 로봇 상태 복구 전송
    for robot_name, status in robot_status_cache.items():
        try:
            await ws.send_json({
                "type": "robot_status",
                "payload": {
                    "name": robot_name,
                    "state": status.get("state", "대기중"),
                },
            })
        except:
            pass

    # 활성 로봇 연결 상태 복구 전송
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
                        "connected": True,
                    },
                })
    except:
        pass

    # 마지막 로봇 위치 복구 전송
    try:
        from app.core.ros.ros_manager import ros_manager
        last_pose = ros_manager.last_pose
        if last_pose:
            await ws.send_json({
                "type": "robot_pose_restore",
                "payload": last_pose,
            })
    except:
        pass


# WebSocket 클라이언트 해제
async def unregister(ws: WebSocket):
    if ws in _active_clients:
        _active_clients.remove(ws)


# 모든 클라이언트에 메시지 브로드캐스트
async def broadcast_json(data: dict):
    for ws in list(_active_clients):
        try:
            await ws.send_json(data)
        except:
            await unregister(ws)


# 동기 코드에서 안전하게 broadcast 호출하기 위한 래퍼
class WSManager:
    def __init__(self):
        self.loop = asyncio.get_event_loop()

    def broadcast(self, data: dict):
        try:
            asyncio.run_coroutine_threadsafe(broadcast_json(data), self.loop)
        except RuntimeError:
            loop = asyncio.get_event_loop()
            asyncio.run_coroutine_threadsafe(broadcast_json(data), loop)


# 전역 WS 매니저
ws_manager = WSManager()


# WebSocket 메시지 핸들러
async def handle_message(ws: WebSocket, data: dict):
    global _last_job

    # 메시지 타입 확인
    msg_type = data.get("type")
    if not msg_type:
        return

    # cmd_vel → 로봇 속도 명령 전달
    if msg_type == "cmd_vel":
        from app.core.ros.ros_manager import ros_manager
        ros_manager.send_cmd_vel(data.get("payload") or {})
        return

    # 입고/출고 요청 → 이동 시작 + 로그 기록 + 핀 이동 명령
    if msg_type == "request_stock_move":
        try:
            from app.core.ros.ros_manager import ros_manager

            payload = data.get("payload") or {}
            stock_id = payload.get("stock_id")
            amount = int(payload.get("amount"))
            mode = payload.get("mode")

            print(f"[WS] 이동 요청 → stock_id={stock_id}, mode={mode}")

            # UI 상태 브로드캐스트 (이동중)
            ws_manager.broadcast({
                "type": "robot_status",
                "payload": {"state": "이동중"},
            })

            # DB에서 stock/pin 조회
            db = SessionLocal()
            stock = db.query(Stock).filter(Stock.id == stock_id).first()
            pin = db.query(Pin).filter(Pin.id == stock.pin_id).first()

            # 마지막 작업 캐시 저장
            _last_job = {"stock_id": stock_id, "amount": amount, "mode": mode}

            # 로봇에게 목표 핀 이동 명령 전송
            ros_manager.send_ui_command(pin.name)

            # 입고/출고 시작 로그 저장
            action = "입고 시작" if mode == "INBOUND" else "출고 시작"
            log_crud.create_log(db, LogCreate(
                robot_name=ros_manager.active_robot,
                pin_name=pin.name,
                category_name=stock.category.name,
                stock_name=stock.name,
                stock_id=stock_id,
                quantity=amount,
                action=action,
                timestamp=now(),
            ))

            db.close()

        except Exception as e:
            print("[WS] 재고 이동 요청 오류:", e)

        return

    # 확인 버튼(완료) → 수량 반영 + 완료 로그 + 0.3초 후 복귀 시작
    if msg_type == "complete_stock_move":
        try:
            from app.core.ros.ros_manager import ros_manager

            job = _last_job
            stock_id = job["stock_id"]
            amount = job["amount"]
            mode = job["mode"]

            # DB에서 재고 반영
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

            # 입고/출고 완료 로그 저장
            action = f"{'입고' if mode=='INBOUND' else '출고'} 완료 ({old_qty} → {new_qty})"
            log_crud.create_log(db, LogCreate(
                robot_name=ros_manager.active_robot,
                pin_name=pin.name,
                category_name=stock.category.name,
                stock_name=stock.name,
                stock_id=stock_id,
                quantity=amount,
                action=action,
                timestamp=now(),
            ))

            db.close()

            # 0.3초 후 복귀 시작 (WAIT 명령 + 상태/로그)
            async def delayed_return():
                await asyncio.sleep(0.3)

                # 로봇 복귀 명령
                ros_manager.send_ui_command("WAIT")

                # UI 상태 브로드캐스트 (복귀중)
                ws_manager.broadcast({
                    "type": "robot_status",
                    "payload": {"state": "복귀중"},
                })

                # 복귀 시작 로그 저장
                db2 = SessionLocal()
                log_crud.create_log(db2, LogCreate(
                    robot_name=ros_manager.active_robot,
                    pin_name="-",
                    category_name="-",
                    stock_name="-",
                    stock_id=None,
                    quantity=0,
                    action="복귀 시작",
                    timestamp=now(),
                ))
                db2.close()

            asyncio.create_task(delayed_return())

        except Exception as e:
            print("[WS] complete_stock_move 오류:", e)

        return

    # robot_status → 상태 캐시 + 도착/복귀완료 로그 + 상태 브로드캐스트
    if msg_type == "robot_status":
        payload = data.get("payload") or {}
        state = payload.get("state")

        from app.core.ros.ros_manager import ros_manager

        # 로봇 이름 보정 (없으면 active_robot 사용)
        name = payload.get("name") or ros_manager.active_robot
        payload["name"] = name

        # 상태 캐시에 저장
        robot_status_cache[name] = {"state": state}

        # 도착 로그 저장
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
                timestamp=now(),
            ))
            db.close()

        # 대기중 상태 → 복귀 완료 로그 저장
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
                timestamp=now(),
            ))
            db.close()

        # 상태 브로드캐스트
        ws_manager.broadcast({
            "type": "robot_status",
            "payload": payload,
        })
        return

    # ui_command → 로봇에 UI 명령 전달
    if msg_type == "ui_command":
        from app.core.ros.ros_manager import ros_manager
        cmd = (data.get("payload") or {}).get("command")
        ros_manager.send_ui_command(cmd)
        return