# app/websocket/handler.py

import json
from app.websocket.manager import broadcast_to_locals, broadcast_to_webs
from app.core.ros.ros_manager import ros_manager


async def handle_message(ws, data: dict):
    msg_type = data.get("type")

    # ✅ 웹 → 로컬: 로봇 연결 요청 (예전 구조 유지)
    if msg_type == "connect_robot":
        await broadcast_to_locals(json.dumps(data))
        return

    # ✅ 웹 → 로컬: 기타 제어 명령 (필요시 사용)
    if msg_type == "control":
        await broadcast_to_locals(json.dumps(data))
        return

    # ✅ 로컬 → 웹: 상태 업데이트
    if msg_type == "status":
        await broadcast_to_webs(json.dumps(data))
        print(f"[EC2] 상태 갱신 → {data.get('payload')}")
        return

    # ✅ 로컬 → 웹: 센서 / 토픽 데이터
    if msg_type in ["odom", "battery", "camera", "diagnostics", "amcl_pose", "nav"]:
        await broadcast_to_webs(json.dumps(data))
        return

    # ✅ [NEW] 웹 → FastAPI → ROS2 : 자동 모드 기어 변경
    # robot.js 에서 보내는 형태:
    #   { type: "auto_speed", payload: { gear: 1|2|3 } }
    if msg_type == "auto_speed":
        payload = data.get("payload") or {}
        gear = int(payload.get("gear", 1))
        print(f"[WS] auto_speed 요청 수신 → gear={gear}")
        ros_manager.set_auto_speed_level(gear)
        return

    # ✅ [최종 구조] 웹 → FastAPI → ROS2 : 수동 cmd_vel 제어
    # robot.js:
    #   { type: "cmd_vel", payload: { linear:{x:..}, angular:{z:..}, gear: ... } }
    if msg_type == "cmd_vel":
        payload = data.get("payload") or data
        ros_manager.send_cmd_vel(payload)
        return

    print(f"[EC2] 미처리 메시지 타입: {msg_type}")