# app/websocket/handler.py

import json
from app.websocket.manager import broadcast_to_locals, broadcast_to_webs
from app.core.ros.ros_manager import ros_manager  # [ADD] RosPublisher 접근용


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

    # ✅ [NEW] 웹 → FastAPI → ROS2: 속도 제어(cmd_vel)
    if msg_type == "cmd_vel":
        # 로봇 연결 여부 확인
        if ros_manager.active_robot and ros_manager.active_robot in ros_manager.clients:
            robot_conn = ros_manager.clients[ros_manager.active_robot]
            if hasattr(robot_conn, "ros") and robot_conn.ros and robot_conn.ros.is_connected:
                try:
                    # [Lazily import] 퍼블리셔 생성 (없으면 새로 만듦)
                    from app.core.ros.publisher import RosPublisher
                    if not hasattr(robot_conn, "publisher"):
                        robot_conn.publisher = RosPublisher(robot_conn.ros)

                    robot_conn.publisher.publish_command(data)
                    print(f"[WS→ROS] cmd_vel 전송 완료 → {ros_manager.active_robot}")
                except Exception as e:
                    print("[WS→ROS] cmd_vel 전송 오류:", e)
            else:
                print("[WS→ROS] 현재 활성 로봇이 연결되어 있지 않음")
        else:
            print("[WS→ROS] 활성 로봇 없음 - cmd_vel 무시")
        return

    print(f"[EC2] 미처리 메시지 타입: {msg_type}")