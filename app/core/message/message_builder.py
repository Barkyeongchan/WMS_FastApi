import time
import json

def build_message(topic_type: str, data: dict) -> dict:
    """
    ROS 토픽 데이터를 표준 WebSocket 메시지 구조로 변환
    (실무형 통합 버전)
    """

    # ISO8601 타임스탬프
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

    # robot_name이 없으면 기본값으로 unknown 설정
    robot_name = data.get("robot_name", "unknown")

    # -----------------------------
    # ✅ 토픽별 후처리 / 정규화
    # -----------------------------
    if topic_type == "battery":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "voltage": data.get("voltage", 0.0),
            "current": data.get("current", 0.0),
            "percentage": data.get("percentage", 0.0),
            "status": data.get("status", "Unknown"),
        }

    elif topic_type == "odom":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "position": data.get("position", {}),
            "orientation": data.get("orientation", {}),
            "linear": data.get("linear", {}),
            "angular": data.get("angular", {}),
        }

    elif topic_type == "amcl_pose":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "x": data.get("x"),
            "y": data.get("y"),
            "orientation": data.get("orientation", {}),
        }

    elif topic_type == "cmd_vel":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "linear_x": data.get("linear_x", 0.0),
            "angular_z": data.get("angular_z", 0.0),
        }

    elif topic_type == "base_link":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "position": data.get("position", {}),
            "orientation": data.get("orientation", {}),
        }

    elif topic_type == "nav":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "path_points": data.get("path_points", []),
        }

    elif topic_type == "teleop_key":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "key": data.get("key", ""),
        }

    elif topic_type == "diagnostics":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "name": data.get("name", ""),
            "message": data.get("message", ""),
            "level": data.get("level", 0),
        }

    elif topic_type == "camera":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "data": data.get("data", ""),
        }

    else:
        # 처리되지 않은 토픽 → 그대로 payload에 전달
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            **data
        }

    # -----------------------------
    # ✅ 표준 메시지 구조로 반환
    # -----------------------------
    return {
        "type": topic_type,
        "payload": payload
    }