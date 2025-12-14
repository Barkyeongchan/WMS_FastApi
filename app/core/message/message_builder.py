import time
import math


# Quaternion -> yaw(rad) 변환
def quaternion_to_yaw(q):
    x = q.get('x', 0.0)
    y = q.get('y', 0.0)
    z = q.get('z', 0.0)
    w = q.get('w', 0.0)

    siny = 2.0 * (w * z + x * y)
    cosy = 1.0 - 2.0 * (y * y + z * z)
    return math.atan2(siny, cosy)


# WebSocket 전송용 메시지 생성
def build_message(topic_type: str, data: dict) -> dict:
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    robot_name = data.get("robot_name", "unknown")

    # 배터리 상태
    if topic_type == "battery":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "voltage": data.get("voltage", 0.0),
            "current": data.get("current", 0.0),
            "percentage": data.get("percentage", 0.0),
            "status": data.get("status", "Unknown"),
        }

    # ODOM 정보
    elif topic_type == "odom":
        ori = data.get("orientation", {})
        theta = quaternion_to_yaw(ori)

        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "position": data.get("position", {}),
            "orientation": ori,
            "linear": data.get("linear", {}),
            "angular": data.get("angular", {}),
            "theta": theta
        }

    # AMCL 전역 위치
    elif topic_type == "amcl_pose":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "x": data.get("x"),
            "y": data.get("y"),
            "theta": data.get("theta"),
            "orientation": data.get("orientation", {})
        }

    # 속도 명령
    elif topic_type == "cmd_vel":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "linear_x": data.get("linear_x", 0.0),
            "angular_z": data.get("angular_z", 0.0),
        }

    # base_link 기준 좌표
    elif topic_type == "base_link":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "position": data.get("position", {}),
            "orientation": data.get("orientation", {}),
            "theta": data.get("theta")
        }

    # 네비게이션 경로
    elif topic_type == "nav":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "path_points": data.get("path_points", []),
        }

    # 텔레옵 키 입력
    elif topic_type == "teleop_key":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "key": data.get("key", ""),
        }

    # 진단 상태 요약
    elif topic_type == "diagnostics":
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            "status": data.get("status", "정상"),
            "color": data.get("color", "green"),
        }

    # 기타 토픽
    else:
        payload = {
            "robot_name": robot_name,
            "timestamp": timestamp,
            **data
        }

    return {
        "type": topic_type,
        "payload": payload
    }