import json

def build_message(topic_type: str, data: dict) -> dict:
    """ROS 토픽 데이터를 표준 WebSocket 메시지 구조로 변환"""

    if topic_type == "battery":
        payload = {
            "robot_name": data.get("robot_name", "unknown"),
            "level": data.get("level", 0.0)  # 퍼센트(0~100)
        }
        
    else:
        payload = data

    return {
        "type": topic_type,
        "payload": payload
    }