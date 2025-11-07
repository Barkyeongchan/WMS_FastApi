# app/websocket/handler.py

import json
from app.websocket.manager import broadcast_to_locals, broadcast_to_webs

async def handle_message(ws, data: dict):
    msg_type = data.get("type")

    # ✅ 웹 → 로컬: 로봇 연결 요청
    if msg_type == "connect_robot":
        await broadcast_to_locals(json.dumps(data))
        return

    # ✅ 웹 → 로컬: 제어 명령
    if msg_type == "control":
        await broadcast_to_locals(json.dumps(data))
        return

    # ✅ 로컬 → 웹: 상태 업데이트
    if msg_type == "status":
        await broadcast_to_webs(json.dumps(data))
        print(f"[EC2] 상태 갱신 → {data['payload']}")
        return

    # ✅ 로컬 → 웹: 센서 / 토픽 데이터
    if msg_type in ["odom", "battery", "camera"]:
        await broadcast_to_webs(json.dumps(data))
        return

    print(f"[EC2] 미처리 메시지 타입: {msg_type}")