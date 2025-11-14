# app/websocket/manager.py
import asyncio
from fastapi import WebSocket

_active_clients = []


async def register(ws: WebSocket):
    """클라이언트 등록"""
    _active_clients.append(ws)
    print(f"[WS] 클라이언트 연결됨 (total={len(_active_clients)}) ✅")

    # ✅ 지연 import로 순환참조 방지
    try:
        from app.core.ros import ros_manager  # ← import를 함수 안으로 이동
        if ros_manager and ros_manager.ros_manager.active_robot:
            name = ros_manager.ros_manager.active_robot
            client = ros_manager.ros_manager.clients.get(name)
            if client and client.connected:
                await ws.send_json({
                    "type": "status",
                    "payload": {
                        "robot_name": name,
                        "ip": client.ip,
                        "connected": True,
                    },
                })
                print(f"[WS] 초기 상태 전송 → {name} ({client.ip}) connected=True")
    except Exception as e:
        print("[WS 초기 상태 전송 실패]", e)


async def unregister(ws: WebSocket):
    """클라이언트 해제"""
    if ws in _active_clients:
        _active_clients.remove(ws)
    print(f"[WS] 클라이언트 해제됨 (total={len(_active_clients)})")


async def broadcast_json(data: dict):
    """비동기 broadcast"""
    for ws in list(_active_clients):
        try:
            await ws.send_json(data)
        except Exception:
            await unregister(ws)


class WSManager:
    """스레드와 비동기 양쪽에서 broadcast 가능"""
    def __init__(self):
        self.loop = asyncio.get_event_loop()

    def broadcast(self, msg: dict):
        """외부 스레드에서도 안전하게 broadcast"""
        try:
            asyncio.run_coroutine_threadsafe(broadcast_json(msg), self.loop)
        except RuntimeError:
            loop = asyncio.get_event_loop()
            asyncio.run_coroutine_threadsafe(broadcast_json(msg), loop)


ws_manager = WSManager()


# ================================
# ✅ 클라이언트 → 서버 메시지 처리
# ================================
async def handle_message(ws: WebSocket, data: dict):
    """
    /ws 엔드포인트에서 받은 메시지를 라우팅하는 헬퍼.

    사용 예시 (connection.py 같은 곳에서):

        data = await websocket.receive_json()
        await manager.handle_message(websocket, data)
    """
    msg_type = data.get("type")
    if not msg_type:
        return

    # ping 은 무시
    if msg_type == "ping":
        return

    if msg_type == "init_request":
        # 필요하면 초기 동기화 로직 추가
        return

    if msg_type == "cmd_vel":
        # ROS 쪽으로 속도 명령 전달
        try:
            from app.core.ros import ros_manager
            payload = data.get("payload") or {}
            ros_manager.ros_manager.send_cmd_vel(payload)
        except Exception as e:
            print("[WS] cmd_vel 처리 오류:", e)